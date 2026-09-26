import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const rootPath = fileURLToPath(new URL("../", import.meta.url));
const checkOnly = process.argv.includes("--check");
const instructionLimit = 8_000;
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

function sameFile(path, expected) {
  return existsSync(path) && readFileSync(path, "utf8").replaceAll("\r\n", "\n") === expected;
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

function requiredText(metadata, source) {
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
  const router = skills.map((skill) => {
    const triggers = skill.useWhen.length ? ` Triggers: ${skill.useWhen.join(" ")}` : "";
    return `- **${skill.name}**: ${skill.description}${triggers}`;
  }).join("\n");
  const instruction = `${baseInstructions}

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
  const { instruction, tools } = requiredText(metadata, source);
  const appPackagePath = join(packagePath, "appPackage");
  const dcrReference = `\${{${packageMetadata.dcrEnvironmentVariable}}}`;
  const manifest = `${JSON.stringify({
    $schema: "https://developer.microsoft.com/en-us/json-schemas/teams/v1.30/MicrosoftTeams.schema.json",
    manifestVersion: "1.30",
    version: packageMetadata.version,
    id: "${{TEAMS_APP_ID}}",
    developer: { name: "WACG Inc.", websiteUrl: "https://projectdata.io/", privacyUrl: "https://projectdata.io/privacy-policy", termsOfUseUrl: "https://projectdata.io/terms-conditions" },
    icons: { color: "color.png", outline: "outline.png" },
    name: { short: `${packageMetadata.shortName} \${{APP_NAME_SUFFIX}}`, full: packageMetadata.title },
    description: { short: packageMetadata.shortDescription, full: `${metadata.description} Uses the existing PDS Project AI service and its metadata-only MPP picker.` },
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
    actions: [{ id: "pdsProjectAiMcp", file: "ai-plugin.json" }],
    $schema: "https://developer.microsoft.com/json-schemas/copilot/declarative-agent/v1.8/schema.json"
  }, null, 2)}\n`;
  const plugin = `${JSON.stringify({
    $schema: "https://developer.microsoft.com/json-schemas/copilot/plugin/v2.4/schema.json",
    schema_version: "v2.4",
    name_for_human: "PDS Project AI",
    description_for_human: `${metadata.title} read-only MPP analysis.`,
    contact_email: "support@projectdata.io",
    namespace: `pdsprojectai${metadata.name.replaceAll("-", "")}`,
    functions: [],
    runtimes: [{ type: "RemoteMCPServer", spec: { url: packageMetadata.mcpEndpoint }, run_for_functions: tools, auth: { type: "OAuthPluginVault", reference_id: dcrReference } }]
  }, null, 2)}\n`;
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

This is one independently deployable, read-only Microsoft 365 declarative-agent package. It contains exactly one Teams manifest declarative-agent entry, its own Teams app lifecycle, and the package-local \`${packageMetadata.dcrEnvironmentVariable}\` binding.

The package uses a role-specific variant of the shared User UI icon, the PDS MCP endpoint, and the metadata-only MCP Apps project-plan picker. It does not expose Project Plan Editor, Project Schedule Generator, or any draft, edit, validation, commit, upload, create, update, or delete tool.

## Generate and Validate

Run \`npm run generate\` and \`npm run validate\` from this directory. These commands only regenerate and structurally validate local source artifacts; they do not provision, deploy, publish, install, or alter tenant resources.

## Development Lifecycle

Keep \`env/.env.*\` local and package-specific. Do not copy \`TEAMS_APP_ID\` or \`${packageMetadata.dcrEnvironmentVariable}\` from another package. From the asset repository, use the [batch lifecycle runbook](../../README.md#development-provisioning-and-organization-submission) to dry-run, provision in a non-production tenant, personally install the dev package, test, then choose tenant-wide sharing or submission for admin review. Tenant sharing grants access but does not preinstall; administrators can optionally preinstall after approval. The coordinator requires \`--execute\` for tenant changes. Do not run \`all --env dev --execute\` if testing must happen between provisioning and submission.

## Migration

This package replaces one role from the retired invalid multi-agent suite. Install it as its own Microsoft 365 app. It does not reuse the retired suite's generated Teams app ID or DCR identifier.
`;
  const files = new Map([
    [join(appPackagePath, "manifest.json"), manifest],
    [join(appPackagePath, "declarativeAgent.json"), agent],
    [join(appPackagePath, "instruction.txt"), instruction],
    [join(appPackagePath, "ai-plugin.json"), plugin],
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

console.log(`${checkOnly ? "Checked" : "Generated"} ${packageSlugs.length} independently deployable ProjectData AI Essentials packages.`);