import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const rootPath = fileURLToPath(new URL("../", import.meta.url));
const checkOnly = process.argv.includes("--check");
const instructionLimit = 8_000;
const supportedCapabilities = new Set(["CodeInterpreter"]);
const workIqWordEndpoint = "https://agent365.svc.cloud.microsoft/agents/tenants/${{WORKIQ_TENANT_ID}}/servers/mcp_WordServer";
const workIqSharePointEndpoint = "https://agent365.svc.cloud.microsoft/agents/tenants/${{WORKIQ_TENANT_ID}}/servers/mcp_SharePointRemoteServer";
const workIqPreviewEndpoint = "https://workiq.svc.cloud.microsoft/mcp";
const workIqOneDriveConversionTools = [
  { name: "fetch_blob_work_iq", description: "Convert an exact OneDrive file to PDF and return the converted bytes without changing the source file.", parameters: { type: "object", properties: { path: { type: "string", description: "Exact server-relative OneDrive content path, for example /me/drive/items/{itemId}/content." }, format: { type: "string", enum: ["pdf"], description: "Requested output format." } }, required: ["path", "format"] } }
];
const workIqSharePointReportTools = [
  { name: "createSmallBinaryFile", description: "Save a generated report file smaller than 5 MB to a specified SharePoint or OneDrive document library.", parameters: { type: "object", properties: { filename: { type: "string" }, base64Content: { type: "string" }, documentLibraryId: { type: "string" }, parentFolderId: { type: "string" } }, required: ["filename", "base64Content", "documentLibraryId"] } },
  { name: "uploadFileFromUrl", description: "Copy a generated report from a SharePoint or OneDrive URL into a specified document library or the user's OneDrive.", parameters: { type: "object", properties: { sourceUrl: { type: "string" }, destinationDocumentLibraryId: { type: "string" }, destinationFolderId: { type: "string" }, filename: { type: "string" } }, required: ["sourceUrl", "destinationDocumentLibraryId"] } }
];
const pickerTools = [
  "open_project_plan_picker",
  "list_project_plan_picker_containers",
  "list_project_plan_picker_children",
  "select_project_plan_picker_file"
];
const packageSlugs = [
  "teams-project-manager-assistant",
  "teams-schedule-quality-analyst",
  "teams-portfolio-executive-analyst",
  "teams-resource-manager",
  "teams-mpp-data-auditor"
];

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function hasEnvironmentValue(path, name) {
  return existsSync(path) && new RegExp(`^${name}=.+$`, "m").test(readFileSync(path, "utf8"));
}

function sameFile(path, expected) {
  return existsSync(path) && readFileSync(path, "utf8").replaceAll("\r\n", "\n") === expected;
}

function createWorkIqPlugin({ namespace, humanName, humanDescription, modelDescription, endpoint, authReference, tools, dataHandling = ["GetPrivateData"] }) {
  return `${JSON.stringify({
    $schema: "https://developer.microsoft.com/json-schemas/copilot/plugin/v2.4/schema.json",
    schema_version: "v2.4",
    name_for_human: humanName,
    description_for_human: humanDescription,
    description_for_model: modelDescription,
    contact_email: "support@projectdata.io",
    namespace,
    functions: tools.map(({ name, description, parameters }) => ({
      name,
      description,
      parameters,
      capabilities: { security_info: { data_handling: dataHandling } }
    })),
    runtimes: [{
      type: "RemoteMCPServer",
      run_for_functions: tools.map(({ name }) => name),
      spec: {
        url: endpoint,
        mcp_tool_description: { tools: tools.map(({ name, description, parameters }) => ({ name, description, inputSchema: parameters })) }
      },
      auth: { type: "OAuthPluginVault", reference_id: authReference }
    }]
  }, null, 2)}\n`;
}

function withoutFrontmatter(value) {
  return value.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n*/, "").trim();
}

function frontmatterValue(value, key) {
  const raw = value.match(new RegExp(`^${key}:\\s*(.+)$`, "m"))?.[1]?.trim();
  if (!raw) throw new Error(`Skill is missing ${key} frontmatter.`);
  return raw.replace(/^['"]|['"]$/g, "");
}

function sectionBullets(value, heading, maximum) {
  const section = value.match(new RegExp(`^## ${heading}\\r?\\n([\\s\\S]*?)(?=^## |\\s*$)`, "m"))?.[1] ?? "";
  return section.split(/\r?\n/).filter((line) => line.startsWith("- ")).slice(0, maximum).map((line) => line.slice(2).trim());
}

function requiredText(metadata, source, capabilities) {
  const skills = metadata.skills.map((skillName) => {
    const catalogSkill = source.catalogSkills.get(skillName);
    if (!catalogSkill || catalogSkill.access !== "read-only") throw new Error(`${metadata.name} maps non-read-only or unknown skill ${skillName}.`);
    const skillPath = join(rootPath, "skills", skillName, "SKILL.md");
    if (!existsSync(skillPath)) throw new Error(`${metadata.name} is missing ${skillName}/SKILL.md.`);
    const skillSource = readFileSync(skillPath, "utf8").replaceAll("\r\n", "\n");
    return {
      name: skillName,
      description: frontmatterValue(skillSource, "description"),
      useWhen: sectionBullets(withoutFrontmatter(skillSource), "Use When", 2),
      tools: catalogSkill.tools
    };
  });
  const tools = [...new Set([...pickerTools, "create_session_from_onedrive", ...skills.flatMap((skill) => skill.tools)])].sort();
  for (const tool of tools) {
    if (!source.knownTools.has(tool) && !pickerTools.includes(tool)) throw new Error(`${metadata.name} maps unknown tool ${tool}.`);
    if (source.knownTools.get(tool) === "Session.ReadWrite" || /(?:create_edit|add_edit|replace_edit|preview_edit|validate_edit|commit|update|delete|upload|new_project|draft)/i.test(tool)) {
      throw new Error(`${metadata.name} maps write-capable tool ${tool}.`);
    }
  }
  const baseInstructions = readFileSync(join(rootPath, "agents", "copilot-studio", metadata.name, "instructions.md"), "utf8").replaceAll("\r\n", "\n").trim();
  const reportFileGeneration = `## Report File Generation

Complete the requested analysis first and ground every report in the selected MPP/PDS evidence. Use Microsoft Work IQ wherever the requested format and configured actions support it. For a Word report saved to OneDrive, use the Work IQ Word action, which accepts HTML or plain text and returns the created document metadata. For a PDF report, prefer creating the Word report with Work IQ and then using the Work IQ OneDrive conversion action with the exact returned item ID as \`/me/drive/items/{itemId}/content\` and \`format: "pdf"\`. The conversion is read-only, does not alter the source document, and is limited to the hosted Work IQ binary-download capability and its size limit. For Excel or PowerPoint, or when Work IQ is unavailable, the conversion limit is exceeded, or the user explicitly wants a direct PDF, use Microsoft 365 Code Interpreter to execute file-generation code and return the resulting file as an attachment; prefer ReportLab for direct PDFs. Do not return HTML, CSS, Python, ReportLab source, or a plan instead of the requested file. Every PDF must include a title, status date and reporting window, executive findings, decisions or recommendations, evidence tables, and a citations section citing the source MPP/PDS basis and relevant project, task, resource, assignment, milestone, or dependency UIDs. Disclose missing data, incomplete pagination, assumptions, and calculations in the file, and verify that any generated or converted file exists, is non-empty, and has the requested format before presenting it. Do not use Work IQ for file discovery, arbitrary URLs, uploads, or project-data access. To persist a generated or converted binary report, use the Work IQ SharePoint report action only when it returns success for content smaller than 5 MB or a supported SharePoint/OneDrive source URL. Ask for the destination library or folder when it is not supplied. Otherwise return the temporary download and explain that it was not persisted. Never claim a file was saved until the relevant Work IQ action returns success.`;
  const workIqContextGuidance = `## Microsoft 365 Work Context

These read-only agents do not use Work IQ for Teams or general SharePoint discovery. Work IQ is limited to user-requested report output: Word documents in OneDrive, exact OneDrive-to-PDF conversion, and generated report files saved through the scoped SharePoint report action. Treat the selected MPP and PDS Project AI as authoritative for schedule facts, and never create, update, delete, share, or upload project data.`;
  const augmentedBaseInstructions = capabilities?.includes("CodeInterpreter") && !baseInstructions.includes("## Report File Generation")
    ? `${baseInstructions}\n\n${reportFileGeneration}\n\n${workIqContextGuidance}`
    : baseInstructions;
  const router = skills.map((skill) => {
    const triggers = skill.useWhen.length ? ` Triggers: ${skill.useWhen.join(" ")}` : "";
    return `- **${skill.name}**: ${skill.description}${triggers}`;
  }).join("\n");
  const instruction = `${augmentedBaseInstructions}

## Microsoft 365 Plan Selection

When analysis needs a plan and the caller has not supplied a session or authorized MPP reference, call \`open_project_plan_picker\`. Use its confirmed \`driveId\`, \`itemId\`, and \`fileName\` only with \`create_session_from_onedrive\`. Do not request an MPP chat attachment, alter the reference, infer a URL, or call picker browse tools outside the picker flow.

## Workflow Execution

Choose the narrowest workflow below. Reuse caller-owned sessions and close sessions created in this turn when no follow-up needs them. Page required collections, cite entity UIDs, state the reporting basis, and disclose missing data, partial pages, and calculations. This agent is read-only: never create, edit, validate, commit, upload, or delete project data.

If a query explicitly returns SessionGone or SessionNotFound, recreate a read-only session once from the user's confirmed OneDrive driveId/itemId/fileName in this conversation, then retry the interrupted query and continue paging. Do not call the picker again or ask the user to select the same file. If recreation or retry fails, report the actual tool error and completed coverage. Never describe a session as expired without an explicit session error.

## Workflow Router

${router}${metadata.name === "mpp-data-auditor" ? `

## Progress Audit

For progress consistency, retrieve every task page with the full task profile before claiming complete coverage; cite task UIDs and conflicting fields. Do not infer stale updates from task dates, and ask for a threshold before calling an update stale.
` : ""}
`;
  if (instruction.length > instructionLimit) throw new Error(`${metadata.name} instructions exceed ${instructionLimit} characters (${instruction.length}).`);
  return { instruction, tools };
}

const catalog = readJson(join(rootPath, "catalog.json"));
const source = {
  catalogSkills: new Map(catalog.skills.map((skill) => [skill.name, skill])),
  knownTools: new Map(readJson(join(rootPath, "schemas", "mcp-tools.json")).tools.map((tool) => [tool.name, tool.scope]))
};

for (const packageSlug of packageSlugs) {
  const packagePath = join(rootPath, "apps", packageSlug);
  const metadataPath = join(packagePath, "source-metadata.json");
  if (!existsSync(metadataPath)) throw new Error(`Missing source metadata for ${packageSlug}.`);
  const packageMetadata = readJson(metadataPath);
  const metadata = readJson(join(rootPath, "agents", "copilot-studio", packageMetadata.role, "agent.json"));
  if (packageMetadata.packageSlug !== packageSlug || metadata.name !== packageMetadata.role || metadata.access !== "read-only") {
    throw new Error(`${packageSlug} does not map to one read-only canonical role.`);
  }
  if (typeof packageMetadata.shortName !== "string" || packageMetadata.shortName.length > 26 || typeof packageMetadata.shortDescription !== "string" || packageMetadata.shortDescription.length > 80) {
    throw new Error(`${packageSlug} has invalid Store display metadata.`);
  }
  if (packageMetadata.capabilities !== undefined && (!Array.isArray(packageMetadata.capabilities) || new Set(packageMetadata.capabilities).size !== packageMetadata.capabilities.length || packageMetadata.capabilities.some((name) => !supportedCapabilities.has(name)))) {
    throw new Error(`${packageSlug} has unsupported or duplicate declarative-agent capabilities.`);
  }
  const { instruction, tools } = requiredText(metadata, source, packageMetadata.capabilities);
  const appPackagePath = join(packagePath, "appPackage");
  const dcrReference = `\${{${packageMetadata.dcrEnvironmentVariable}}}`;
  const workIqWordAuthEnvironmentVariable = `WORKIQ_WORD_AUTH_ID_${metadata.name.replaceAll("-", "_").toUpperCase()}`;
  const workIqOneDriveConversionAuthEnvironmentVariable = `WORKIQ_ONEDRIVE_CONVERSION_AUTH_ID_${metadata.name.replaceAll("-", "_").toUpperCase()}`;
  const workIqSharePointAuthEnvironmentVariable = `WORKIQ_SHAREPOINT_REPORTS_AUTH_ID_${metadata.name.replaceAll("-", "_").toUpperCase()}`;
  const workIqWordAuthReference = `\${{${workIqWordAuthEnvironmentVariable}}}`;
  const workIqOneDriveConversionAuthReference = `\${{${workIqOneDriveConversionAuthEnvironmentVariable}}}`;
  const workIqSharePointAuthReference = `\${{${workIqSharePointAuthEnvironmentVariable}}}`;
  const developmentEnvironmentPath = join(packagePath, "env", ".env.dev");
  const developmentWorkIqEnabled = [
    "WORKIQ_TENANT_ID",
    workIqWordAuthEnvironmentVariable,
    workIqOneDriveConversionAuthEnvironmentVariable,
    workIqSharePointAuthEnvironmentVariable
  ].every((name) => hasEnvironmentValue(developmentEnvironmentPath, name));
  const manifest = `${JSON.stringify({
    $schema: "https://developer.microsoft.com/en-us/json-schemas/teams/v1.30/MicrosoftTeams.schema.json",
    manifestVersion: "1.30",
    version: packageMetadata.version,
    id: "${{TEAMS_APP_ID}}",
    developer: { name: "WACG Inc.", websiteUrl: "https://projectdata.io/", privacyUrl: "https://projectdata.io/privacy-policy", termsOfUseUrl: "https://projectdata.io/terms-conditions" },
    icons: { color: "color.png", outline: "outline.png" },
    name: { short: `${packageMetadata.shortName} \${{APP_NAME_SUFFIX}}`, full: packageMetadata.title },
    description: { short: packageMetadata.shortDescription, full: `${metadata.description} Connects to your existing PDS Project AI service to help you find and analyze project schedules. It only reads project information and never changes your project files.` },
    accentColor: "#FFFFFF",
    supportsChannelFeatures: "tier1",
    composeExtensions: [],
    copilotAgents: { declarativeAgents: [{ id: metadata.name, file: "declarativeAgent.json" }] },
    permissions: ["identity", "messageTeamMembers"],
    validDomains: []
  }, null, 2)}\n`;
  const agent = `${JSON.stringify({
    version: "v1.8",
    name: `${metadata.title} \${{APP_NAME_SUFFIX}}`,
    description: metadata.description,
    instructions: "$[file('instruction.txt')]",
    conversation_starters: packageMetadata.conversationStarters.map((text) => ({ text, title: text.split(/[.:]/)[0] })),
    actions: [
      { id: "pdsProjectAiMcp", file: "ai-plugin.json" },
      { id: "workIqWordMcp", file: "workiq-word-plugin.json" },
      { id: "workIqOneDriveConversionMcp", file: "workiq-onedrive-conversion-plugin.json" },
      { id: "workIqSharePointReportsMcp", file: "workiq-sharepoint-reports-plugin.json" }
    ],
    ...(packageMetadata.capabilities ? { capabilities: packageMetadata.capabilities.map((name) => ({ name })) } : {}),
    $schema: "https://developer.microsoft.com/json-schemas/copilot/declarative-agent/v1.8/schema.json"
  }, null, 2)}\n`;
  const developmentAgentObject = JSON.parse(agent);
  developmentAgentObject.instructions = "$[file('instruction.dev.txt')]";
  developmentAgentObject.actions = developmentWorkIqEnabled
    ? developmentAgentObject.actions
    : [{ id: "pdsProjectAiMcp", file: "ai-plugin.json" }];
  const developmentAgent = `${JSON.stringify(developmentAgentObject, null, 2)}\n`;
  const developmentManifest = manifest.replace('"declarativeAgent.json"', '"declarativeAgent.dev.json"');
  const developmentInstruction = developmentWorkIqEnabled
    ? `${instruction}\n\n## Development Capability Boundary\n\nThis development package includes the configured Work IQ Word, OneDrive conversion, and report-storage actions. Use them according to the report-file rules above. Never claim that a report was saved until the relevant Work IQ action returns success.`
    : `${instruction}\n\n## Development Capability Boundary\n\nThis development package does not include the Work IQ Word, OneDrive conversion, or report-storage actions because its local environment has no Work IQ auth bindings. Use the Code Interpreter fallback for temporary report downloads in development, and never claim that a report was saved to OneDrive or SharePoint. The canonical package uses Work IQ where its configured actions are available.`;
  const plugin = `${JSON.stringify({
    $schema: "https://developer.microsoft.com/json-schemas/copilot/plugin/v2.4/schema.json",
    schema_version: "v2.4",
    name_for_human: "PDS Project AI",
    description_for_human: `${metadata.title} read-only MPP analysis.`,
    contact_email: "support@projectdata.io",
    namespace: `pdsprojectai${metadata.name.replaceAll("-", "")}`,
    functions: [],
    runtimes: [{ type: "RemoteMCPServer", spec: { url: packageMetadata.mcpEndpoint }, run_for_functions: ["*"], auth: { type: "OAuthPluginVault", reference_id: dcrReference } }]
  }, null, 2)}\n`;
  const workIqWordPlugin = `${JSON.stringify({
    $schema: "https://developer.microsoft.com/json-schemas/copilot/plugin/v2.4/schema.json",
    schema_version: "v2.4",
    name_for_human: "Work IQ Word",
    description_for_human: "Create Word reports in the user's OneDrive.",
    description_for_model: "Use this action when the user asks to create or save a project report as a Word document in their OneDrive. Do not use it for Excel, PowerPoint, PDF, or temporary download-only requests.",
    contact_email: "support@projectdata.io",
    namespace: `workiqword${metadata.name.replaceAll("-", "")}`,
    functions: [{
      name: "WordCreateNewDocument",
      description: "Create a new Word report in the user's OneDrive root from HTML or plain text content.",
      parameters: {
        type: "object",
        properties: {
          fileName: { type: "string", description: "The desired .docx file name." },
          contentInHtml: { type: "string", description: "The report body as HTML or plain text." }
        },
        required: ["fileName", "contentInHtml"]
      },
      capabilities: {
        security_info: { data_handling: ["GetPrivateData", "ResourceStateUpdate"] }
      }
    }],
    runtimes: [{
      type: "RemoteMCPServer",
      run_for_functions: ["WordCreateNewDocument"],
      spec: {
        url: workIqWordEndpoint,
        mcp_tool_description: {
          tools: [{
            name: "WordCreateNewDocument",
            description: "Creates a new Word document in the root of the user's OneDrive from HTML or plain text.",
            inputSchema: {
              type: "object",
              properties: {
                fileName: { type: "string", description: "Desired file name; use a .docx extension." },
                contentInHtml: { type: "string", description: "HTML or plain text content for the document body." }
              },
              required: ["fileName", "contentInHtml"]
            }
          }]
        }
      },
      auth: { type: "OAuthPluginVault", reference_id: workIqWordAuthReference }
    }]
  }, null, 2)}\n`;
  const workIqSharePointReportsPlugin = createWorkIqPlugin({
    namespace: `workiqsharepointreports${metadata.name.replaceAll("-", "")}`,
    humanName: "Work IQ Report Storage",
    humanDescription: "Save generated report files to OneDrive or SharePoint.",
    modelDescription: "Use this action only to persist a report file the agent has just generated or converted. createSmallBinaryFile is limited to files smaller than 5 MB and requires a destination document library; uploadFileFromUrl accepts only a supported SharePoint or OneDrive source URL. Do not use this action for project-data CRUD or general SharePoint discovery.",
    endpoint: workIqSharePointEndpoint,
    authReference: workIqSharePointAuthReference,
    tools: workIqSharePointReportTools,
    dataHandling: ["GetPrivateData", "ResourceStateUpdate"]
  });
  const workIqOneDriveConversionPlugin = createWorkIqPlugin({
    namespace: `workiqonedriveconversion${metadata.name.replaceAll("-", "")}`,
    humanName: "Work IQ OneDrive Conversion",
    humanDescription: "Convert an exact generated OneDrive document to PDF.",
    modelDescription: "Use this action only to convert an exact Word document already created by this agent in the user's OneDrive to PDF. Pass the exact /me/drive/items/{itemId}/content path returned by the Word action and format pdf. This is read-only and does not discover, upload, modify, share, or delete files.",
    endpoint: workIqPreviewEndpoint,
    authReference: workIqOneDriveConversionAuthReference,
    tools: workIqOneDriveConversionTools,
    dataHandling: ["GetPrivateData", "DataTransform"]
  });
  const packageJson = `${JSON.stringify({
    name: `@pds-project-ai/${packageSlug}`,
    version: packageMetadata.version,
    private: true,
    type: "module",
    scripts: { generate: "node scripts/generate-instructions.mjs", validate: "node scripts/validate-package.mjs" }
  }, null, 2)}\n`;
  const generateScript = `import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

execFileSync(process.execPath, [fileURLToPath(new URL("../../../scripts/generate-teams-packages.mjs", import.meta.url))], { stdio: "inherit" });
`;
  const validateScript = `import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

execFileSync(process.execPath, [fileURLToPath(new URL("../../../scripts/validate-teams-packages.mjs", import.meta.url))], { stdio: "inherit" });
`;
  const readme = `# ${packageMetadata.title}

This is one independently deployable Microsoft 365 declarative-agent package. It contains exactly one Teams manifest declarative-agent entry, its own Teams app lifecycle, the package-local \`${packageMetadata.dcrEnvironmentVariable}\` binding, and package-local Work IQ Word, OneDrive conversion, and report-storage auth bindings.

The package uses a role-specific variant of the shared User UI icon, the PDS MCP endpoint, the metadata-only MCP Apps project-plan picker, Microsoft Work IQ Word document creation, read-only OneDrive-to-PDF conversion, and scoped report-file persistence. It does not expose Project Plan Editor, Project Schedule Generator, or any project-data draft, edit, validation, commit, upload, create, update, or delete tool.${packageMetadata.capabilities?.includes("CodeInterpreter") ? " Code Interpreter can generate temporary Excel, PowerPoint, PDF, and Word files; Work IQ Word can save Word reports to OneDrive, Work IQ OneDrive conversion can convert an exact generated OneDrive Word file to PDF, and the scoped SharePoint action can persist generated binary reports." : ""}

## Work IQ Word Setup

The Word action uses Microsoft’s preview \`mcp_WordServer\` endpoint. Before packaging or publishing, set \`WORKIQ_TENANT_ID\` and the package-local \`${workIqWordAuthEnvironmentVariable}\` in \`env/.env.dev\` or \`env/.env.prod\`. Create the latter as a Microsoft Entra SSO auth configuration for this package’s Teams app, using the Word server endpoint as its base URL. The auth configuration must authorize the Microsoft Work IQ Word MCP server; it is not the PDS DCR binding and cannot be created with the PDS \`dcr/register\` step.

## Work IQ OneDrive Conversion Setup

The conversion action uses the preview Work IQ hosted MCP endpoint \`${workIqPreviewEndpoint}\` and exposes only \`fetch_blob_work_iq\` with the PDF format. Before packaging or publishing, set the package-local \`${workIqOneDriveConversionAuthEnvironmentVariable}\` in \`env/.env.dev\` or \`env/.env.prod\`. Create it as a separate Microsoft Entra SSO auth configuration for the hosted Work IQ endpoint. The action accepts only an exact \`/me/drive/items/{itemId}/content\` path and returns converted bytes without changing the source file. Work IQ conversion is tenant-dependent and limited to the hosted binary-download size limit (currently documented as 4 MB); larger or unsupported files remain temporary Code Interpreter downloads.

## Work IQ Report Storage Setup

The report-storage action uses \`mcp_SharePointRemoteServer\` and exposes only \`createSmallBinaryFile\` and \`uploadFileFromUrl\`. It does not provide SharePoint discovery or read access. Before packaging or publishing, set \`${workIqSharePointAuthEnvironmentVariable}\` alongside \`WORKIQ_TENANT_ID\`, and create a Microsoft Entra SSO auth configuration for the SharePoint endpoint. The binding is independent of the PDS DCR and Word auth configurations. Files written through \`createSmallBinaryFile\` must be smaller than 5 MB; larger or unsupported artifacts remain temporary downloads.

## Generate and Validate

Run \`npm run generate\` and \`npm run validate\` from this directory. These commands only regenerate and structurally validate local source artifacts; they do not provision, deploy, publish, install, or alter tenant resources.

## Development Lifecycle

Keep \`env/.env.*\` local and package-specific. Do not copy \`TEAMS_APP_ID\` or \`${packageMetadata.dcrEnvironmentVariable}\` from another package. From the asset repository, use the [batch lifecycle runbook](../../README.md#development-provisioning-and-organization-submission) to dry-run, provision in a non-production tenant, personally install the dev package, test, then choose tenant-wide sharing or submission for admin review. Tenant sharing grants access but does not preinstall; administrators can optionally preinstall after approval. The coordinator requires \`--execute\` for tenant changes. Do not run \`all --env dev --execute\` if testing must happen between provisioning and submission.

## Migration

This package replaces one role from the retired invalid multi-agent suite. Install it as its own Microsoft 365 app. It does not reuse the retired suite's generated Teams app ID or DCR identifier.
`;
  const files = new Map([
    [join(appPackagePath, "manifest.json"), manifest],
    [join(appPackagePath, "manifest.dev.json"), developmentManifest],
    [join(appPackagePath, "declarativeAgent.json"), agent],
    [join(appPackagePath, "declarativeAgent.dev.json"), developmentAgent],
    [join(appPackagePath, "instruction.txt"), instruction],
    [join(appPackagePath, "instruction.dev.txt"), developmentInstruction],
    [join(appPackagePath, "ai-plugin.json"), plugin],
    [join(appPackagePath, "workiq-word-plugin.json"), workIqWordPlugin],
    [join(appPackagePath, "workiq-onedrive-conversion-plugin.json"), workIqOneDriveConversionPlugin],
    [join(appPackagePath, "workiq-sharepoint-reports-plugin.json"), workIqSharePointReportsPlugin],
    [join(packagePath, "package.json"), packageJson],
    [join(packagePath, "scripts", "generate-instructions.mjs"), generateScript],
    [join(packagePath, "scripts", "validate-package.mjs"), validateScript],
    [join(packagePath, "README.md"), readme],
    [join(packagePath, ".gitignore"), "appPackage/build/\nenv/\n"]
  ]);
  for (const [path, contents] of files) {
    if (checkOnly) {
      if (!sameFile(path, contents)) throw new Error(`${packageSlug} generated artifact is missing or stale: ${path}.`);
    } else {
      mkdirSync(join(path, ".."), { recursive: true });
      writeFileSync(path, contents, "utf8");
    }
  }
  for (const icon of ["color.png", "outline.png"]) {
    const sourceIcon = join(rootPath, "shared", "agent-icons", packageSlug, icon);
    const packageIcon = join(appPackagePath, icon);
    if (!existsSync(sourceIcon)) throw new Error(`Missing agent icon for ${packageSlug}: ${icon}.`);
    if (!existsSync(packageIcon) || !readFileSync(packageIcon).equals(readFileSync(sourceIcon))) {
      if (checkOnly) throw new Error(`${packageSlug} has a missing or stale icon ${icon}.`);
      copyFileSync(sourceIcon, packageIcon);
    }
  }
}

console.log(`${checkOnly ? "Checked" : "Generated"} ${packageSlugs.length} independently deployable PDS Project AI packages.`);