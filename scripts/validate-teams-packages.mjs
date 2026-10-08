import { existsSync, readdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const rootPath = fileURLToPath(new URL("../", import.meta.url));
const expected = new Map([
  ["teams-project-manager-assistant", "project-manager-assistant"],
  ["teams-schedule-quality-analyst", "schedule-quality-analyst"],
  ["teams-portfolio-executive-analyst", "portfolio-executive-analyst"],
  ["teams-resource-manager", "resource-manager"],
  ["teams-mpp-data-auditor", "mpp-data-auditor"],
  ["teams-project-plan-editor", "project-plan-editor"],
  ["teams-project-schedule-generator", "project-schedule-generator"]
]);
const marketplacePackages = new Set([
  "teams-project-manager-assistant",
  "teams-schedule-quality-analyst",
  "teams-portfolio-executive-analyst",
  "teams-resource-manager",
  "teams-mpp-data-auditor"
]);
const commitRoles = new Set(["project-plan-editor", "project-schedule-generator"]);
const commitContextCapabilities = ["OneDriveAndSharePoint", "TeamsMessages", "Email"];
const readOnlyContextCapabilities = ["OneDriveAndSharePoint", "TeamsMessages", "Email"];
const catalog = JSON.parse(readFileSync(join(rootPath, "catalog.json"), "utf8"));
const catalogSkills = new Map(catalog.skills.map((skill) => [skill.name, skill]));
const knownTools = new Map(JSON.parse(readFileSync(join(rootPath, "schemas", "mcp-tools.json"), "utf8")).tools.map((tool) => [tool.name, tool.scope]));
const writeTools = /(?:create_edit|add_edit|replace_edit|preview_edit|validate_edit|commit|update|delete|upload|new_project|draft)/i;
const excluded = /Session\.ReadWrite|commit_edit_draft/i;
const failures = [];
const appIds = new Set();
const dcrVariables = new Set();
const iconVariants = new Map([["color.png", new Set()], ["outline.png", new Set()]]);
const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function hasEnvironmentValue(path, name) {
  return existsSync(path) && new RegExp(`^${name}=.+$`, "m").test(readFileSync(path, "utf8"));
}

for (const [packageSlug, role] of expected) {
  const packagePath = join(rootPath, "apps", packageSlug);
  const appPackagePath = join(packagePath, "appPackage");
  const metadataPath = join(packagePath, "source-metadata.json");
  const manifestPath = join(appPackagePath, "manifest.json");
  const developmentManifestPath = join(appPackagePath, "manifest.dev.json");
  if (!existsSync(metadataPath) || !existsSync(manifestPath) || !existsSync(developmentManifestPath)) {
    failures.push(`${packageSlug} is missing source metadata or manifest.`);
    continue;
  }
  const metadata = JSON.parse(readFileSync(metadataPath, "utf8"));
  const access = metadata.access ?? "read-only";
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const developmentManifest = JSON.parse(readFileSync(developmentManifestPath, "utf8"));
  const declarativeAgentPath = join(appPackagePath, "declarativeAgent.json");
  const developmentDeclarativeAgentPath = join(appPackagePath, "declarativeAgent.dev.json");
  const declarativeAgent = existsSync(declarativeAgentPath) ? JSON.parse(readFileSync(declarativeAgentPath, "utf8")) : {};
  const developmentDeclarativeAgent = existsSync(developmentDeclarativeAgentPath) ? JSON.parse(readFileSync(developmentDeclarativeAgentPath, "utf8")) : {};
  const expectedCapabilities = metadata.capabilities ?? [];
  const actualCapabilities = (declarativeAgent.capabilities ?? []).map((capability) => capability.name);
  const developmentCapabilities = (developmentDeclarativeAgent.capabilities ?? []).map((capability) => capability.name);
  if (JSON.stringify(actualCapabilities) !== JSON.stringify(expectedCapabilities)) failures.push(`${packageSlug} does not preserve its declared agent capabilities.`);
  if (JSON.stringify(developmentCapabilities) !== JSON.stringify(expectedCapabilities)) failures.push(`${packageSlug} dev agent does not preserve its declared capabilities.`);
  if (access === "read-only" && readOnlyContextCapabilities.some((capability) => !expectedCapabilities.includes(capability))) failures.push(`${packageSlug} must enable read-only SharePoint/OneDrive, Teams message, and email context capabilities.`);
  if (commitRoles.has(role) && JSON.stringify([...expectedCapabilities].sort()) !== JSON.stringify([...commitContextCapabilities].sort())) failures.push(`${packageSlug} must enable only read-only SharePoint/OneDrive, Teams message, and email context capabilities.`);
  const entries = manifest.copilotAgents?.declarativeAgents ?? [];
  if (metadata.packageSlug !== packageSlug || metadata.role !== role || !["read-only", "commit"].includes(access) || access === "commit" !== commitRoles.has(role) || !/^MCP_DA_AUTH_ID_[A-Z_]+$/.test(metadata.dcrEnvironmentVariable) || typeof metadata.shortName !== "string" || metadata.shortName.length > 26 || typeof metadata.shortDescription !== "string" || metadata.shortDescription.length > 80) failures.push(`${packageSlug} has invalid package-local metadata.`);
  if (entries.length !== 1 || entries[0]?.id !== role || entries[0]?.file !== "declarativeAgent.json") failures.push(`${packageSlug} must expose exactly one local declarative agent.`);
  const roleSuffix = role.replaceAll("-", "_").toUpperCase();
  const developmentWorkIqEnabled = access === "read-only" && [
    "WORKIQ_TENANT_ID",
    `WORKIQ_WORD_AUTH_ID_${roleSuffix}`,
    `WORKIQ_ONEDRIVE_CONVERSION_AUTH_ID_${roleSuffix}`,
    `WORKIQ_SHAREPOINT_REPORTS_AUTH_ID_${roleSuffix}`
  ].every((name) => hasEnvironmentValue(join(packagePath, "env", ".env.dev"), name));
  const expectedDevelopmentActions = developmentWorkIqEnabled
    ? "pdsProjectAiMcp:ai-plugin.json|workIqWordMcp:workiq-word-plugin.json|workIqOneDriveConversionMcp:workiq-onedrive-conversion-plugin.json|workIqSharePointReportsMcp:workiq-sharepoint-reports-plugin.json"
    : "pdsProjectAiMcp:ai-plugin.json";
  if (developmentManifest.copilotAgents?.declarativeAgents?.[0]?.file !== "declarativeAgent.dev.json" || developmentDeclarativeAgent.actions?.map((action) => `${action.id}:${action.file}`).join("|") !== expectedDevelopmentActions) failures.push(`${packageSlug} dev package must expose PDS plus Work IQ actions only when all local Work IQ bindings exist.`);
  if (manifest.id !== "${{TEAMS_APP_ID}}") failures.push(`${packageSlug} must use its package-local Teams app placeholder.`);
  if (manifest.name?.short !== `${metadata.shortName} \${{APP_NAME_SUFFIX}}` || manifest.description?.short !== metadata.shortDescription) failures.push(`${packageSlug} does not use its Store display metadata.`);
  if (!manifest.description?.full?.startsWith("Powered by PDS Project AI.") || manifest.description.full.includes("Connects to your existing PDS Project AI service.")) failures.push(`${packageSlug} must use the concise PDS product attribution in its full description.`);
  if (dcrVariables.has(metadata.dcrEnvironmentVariable)) failures.push(`${packageSlug} reuses a DCR environment variable.`);
  dcrVariables.add(metadata.dcrEnvironmentVariable);
  if (appIds.has(manifest.id) && manifest.id !== "${{TEAMS_APP_ID}}") failures.push(`${packageSlug} reuses a generated Teams app ID.`);
  appIds.add(manifest.id);
  const requiredPackageFiles = ["declarativeAgent.json", "declarativeAgent.dev.json", "instruction.txt", "instruction.dev.txt", "ai-plugin.json", "color.png", "outline.png"];
  if (access === "read-only") requiredPackageFiles.push("workiq-word-plugin.json", "workiq-onedrive-conversion-plugin.json", "workiq-sharepoint-reports-plugin.json");
  for (const name of requiredPackageFiles) {
    if (!existsSync(join(appPackagePath, name))) failures.push(`${packageSlug} is missing ${name}.`);
  }
  if (access === "commit" && ["workiq-word-plugin.json", "workiq-onedrive-conversion-plugin.json", "workiq-sharepoint-reports-plugin.json"].some((name) => existsSync(join(appPackagePath, name)))) failures.push(`${packageSlug} must not include report-generation Work IQ actions.`);
  const instructionPath = join(appPackagePath, "instruction.txt");
  const instruction = existsSync(instructionPath) ? readFileSync(instructionPath, "utf8") : "";
  if (existsSync(instructionPath)) {
    if (access === "read-only") {
      for (const tool of ["open_project_plan_picker", "create_session_from_onedrive", "get_project", "list_tasks", "list_resources", "list_assignments", "close_session", "WordCreateNewDocument", "fetch_blob_work_iq", "createSmallBinaryFile", "uploadFileFromUrl"]) {
        if (!instruction.includes(`\`${tool}\``)) failures.push(`${packageSlug} is missing read-only/report tool guidance for ${tool}.`);
      }
      if (/Workflow Router|`mpp-[a-z-]+`/i.test(instruction)) failures.push(`${packageSlug} must use direct MCP calls rather than skill routing.`);
      const readGuards = [
        [/Never edit, validate, commit, upload, or delete project data/i, "read-only project boundary"],
        [/reuse the session ID.*at most once for the whole audit.*explicitly identifies.*SessionGone.*SessionNotFound/is, "bounded session recovery"],
        [/Keep the session open while any requested check is incomplete/i, "session retention for incomplete audits"],
        [/continue each query while.*nextSkipToken.*Verify the accumulated item count against the returned.*count/is, "complete analysis pagination"],
        [/selected MPP\/PDS session is authoritative/i, "authoritative plan evidence"],
        [/untrusted data, not authorization/i, "untrusted source handling"],
        [/## PMI Alignment/i, "PMI-aligned analysis"],
        [/PMI\/PMBOK.*tailored recommendations/is, "context-tailored PMI recommendations"],
        [/do not invent PMI limits, clause citations, or compliance scores/i, "honest PMI attribution"],
        [/Do not claim PMI compliance or certification from MPP data alone/i, "bounded PMI assurance"],
        [/PMBOK Guide Eighth Edition overview.*organization-selected edition/is, "explicit PMI reference basis"],
        [/evidence, delivery impact, and recommendation/i, "actionable PMI analysis"],
        [/Close only sessions you created/i, "session ownership"],
        [/Word.*prefer.*Work IQ/is, "Word report preference"],
        [/PDF.*prefer Word creation/is, "PDF conversion preference"],
        [/Conversion is read-only.*size limit/is, "bounded read-only conversion"],
        [/Code Interpreter.*Return the file, not/is, "executed report attachments"],
        [/citations.*limitations/is, "report evidence and limitations"],
        [/Claim saving only after the action succeeds/i, "verified report persistence"]
      ];
      for (const [pattern, behavior] of readGuards) {
        if (!pattern.test(instruction)) failures.push(`${packageSlug} is missing ${behavior} guidance.`);
      }
      if (role === "mpp-data-auditor" && !/progress consistency.*every task page.*full task profile/is.test(instruction)) failures.push("MPP Data Auditor must retain full-profile progress audit coverage.");
    } else {
      for (const tool of ["create_new_project_session", "get_edit_capabilities", "create_edit_draft", "add_edit_operations", "replace_edit_operations", "preview_edit_draft", "validate_edit_draft", "commit_edit_draft", "open_project_plan_download", "close_session"]) {
        if (!instruction.includes(`\`${tool}\``)) failures.push(`${packageSlug} is missing MCP workflow guidance for ${tool}.`);
      }
      if (/Workflow Router|`mpp-[a-z-]+`|Meeting-to-MPP/i.test(instruction)) failures.push(`${packageSlug} must use a source-neutral MCP workflow without skill routing.`);
      const workflowGuards = [
        [/same validated `editId`/i, "reuse of the validated draft"],
        [/do not append them again/i, "duplicate-staging prevention"],
        [/draft.*without committing/i, "draft-only requests"],
        [/completion only after commit and output availability/i, "verified completion"],
        [/idempotencyKey.*retries/is, "idempotent retries"],
        [/persisted entities.*actual UIDs/is, "created-entity UID readback"],
        [/untrusted.*never as authorization/is, "untrusted source handling"],
        [/possibly committed edits blindly/i, "safe session recovery"],
        [/Close only sessions you created/i, "session ownership"]
      ];
      for (const [pattern, behavior] of workflowGuards) {
        if (!pattern.test(instruction)) failures.push(`${packageSlug} is missing ${behavior} guidance.`);
      }
      if (role === "project-schedule-generator") {
        const planningGuards = [
          [/Tool discovery is not tool execution/i, "tool-execution truthfulness"],
          [/never claim a session, draft, validation, commit, or download succeeded unless its actual tool result is present/i, "verified tool outcomes"],
          [/## PMI Alignment/, "PMI-aligned planning"],
          [/PMI\/PMBOK.*tailored recommendations/is, "tailored PMI recommendations"],
          [/do not invent PMI limits, clause citations, or compliance scores/i, "honest PMI attribution"],
          [/Do not claim PMI compliance or certification from MPP data alone/i, "bounded PMI assurance"],
          [/PMBOK Guide Eighth Edition overview.*organization-selected edition/is, "explicit PMI reference basis"],
          [/committed MPP is not automatically an approved baseline/i, "baseline approval distinction"],
          [/agreed outcomes and deliverables.*justified prerequisites/is, "deliverable and dependency planning"]
        ];
        for (const [pattern, behavior] of planningGuards) {
          if (!pattern.test(instruction)) failures.push(`${packageSlug} is missing ${behavior} guidance.`);
        }
      }
    }
  }
  if (access === "read-only" && existsSync(join(appPackagePath, "instruction.dev.txt"))) {
    const developmentInstruction = readFileSync(join(appPackagePath, "instruction.dev.txt"), "utf8");
    if (!/Return the file, not HTML, CSS, Python/i.test(developmentInstruction) || !/citations/i.test(developmentInstruction)) failures.push(`${packageSlug} must require executed, cited report-file attachments.`);
  }
  for (const [name, variants] of iconVariants) {
    const iconPath = join(appPackagePath, name);
    const sourcePath = join(rootPath, "shared", "agent-icons", packageSlug, name);
    if (!existsSync(iconPath) || !existsSync(sourcePath)) {
      failures.push(`${packageSlug} is missing the role-specific ${name}.`);
      continue;
    }
    const icon = readFileSync(iconPath);
    const dimension = name === "color.png" ? 192 : 32;
    if (icon.length < 24 || !icon.subarray(0, 8).equals(pngSignature) || icon.readUInt32BE(16) !== dimension || icon.readUInt32BE(20) !== dimension || !icon.equals(readFileSync(sourcePath))) failures.push(`${packageSlug} has an invalid or stale ${name}.`);
    variants.add(icon.toString("base64"));
  }
  if (existsSync(join(appPackagePath, "ai-plugin.json"))) {
    const plugin = JSON.parse(readFileSync(join(appPackagePath, "ai-plugin.json"), "utf8"));
    const tools = plugin.runtimes?.[0]?.run_for_functions ?? [];
    if (plugin.runtimes?.[0]?.auth?.reference_id !== `\${{${metadata.dcrEnvironmentVariable}}}`) failures.push(`${packageSlug} does not use its own DCR binding.`);
    const usesDynamicDiscovery = tools.length === 1 && tools[0] === "*";
    if (access === "read-only") {
      if (!usesDynamicDiscovery && (!tools.includes("open_project_plan_picker") || !tools.includes("create_session_from_onedrive"))) failures.push(`${packageSlug} lacks the shared picker/session flow.`);
      if (new Set(tools).size !== tools.length || tools.some((tool) => knownTools.get(tool) === "Session.ReadWrite" || writeTools.test(tool))) failures.push(`${packageSlug} exposes a write-capable MCP tool.`);
    } else {
      const agentDefinition = JSON.parse(readFileSync(join(rootPath, "agents", "copilot-studio", role, "agent.json"), "utf8"));
      const expectedTools = [...new Set([
        "create_session_from_onedrive",
        ...agentDefinition.skills.flatMap((skillName) => catalogSkills.get(skillName)?.tools ?? []),
        ...(role === "project-schedule-generator" ? ["create_project_schedule"] : [])
      ])].filter((tool) => knownTools.has(tool)).sort();
      if (usesDynamicDiscovery || JSON.stringify([...tools].sort()) !== JSON.stringify(expectedTools)) failures.push(`${packageSlug} must expose only its mapped PDS MCP tools.`);
      if (!tools.includes("commit_edit_draft") || !tools.includes("validate_edit_draft") || tools.some((tool) => !knownTools.has(tool))) failures.push(`${packageSlug} is missing guarded edit tools or exposes an unknown MCP tool.`);
      if (commitRoles.has(role) && !tools.includes("create_new_project_session")) failures.push(`${packageSlug} must expose create_new_project_session.`);
      if (role === "project-schedule-generator" && !tools.includes("create_project_schedule")) failures.push(`${packageSlug} must expose atomic create_project_schedule.`);
      if (role === "project-schedule-generator" && !tools.includes("open_project_plan_download")) failures.push(`${packageSlug} must expose the clickable MPP download tool.`);
      if (role === "project-schedule-generator" && (!plugin.description_for_model?.includes("create_project_schedule") || !plugin.description_for_model.includes("Tool discovery is not execution") || !plugin.description_for_model.includes("Do not call create_new_project_session"))) failures.push(`${packageSlug} must advertise atomic schedule creation and verified tool outcomes in its PDS tool description.`);
      if (role === "project-schedule-generator" && (!instruction.includes("For a new schedule, call `create_project_schedule` once") || !instruction.includes("`parentTaskKey` links") || !instruction.includes("Do not start new-plan creation with `create_new_project_session`"))) failures.push(`${packageSlug} must route hierarchical new-plan generation through the atomic schedule tool.`);
    }
  }
  const actionSignature = (declarativeAgent.actions ?? []).map((action) => `${action.id}:${action.file}`).join("|");
  const expectedActionSignature = access === "commit"
    ? "pdsProjectAiMcp:ai-plugin.json"
    : "pdsProjectAiMcp:ai-plugin.json|workIqWordMcp:workiq-word-plugin.json|workIqOneDriveConversionMcp:workiq-onedrive-conversion-plugin.json|workIqSharePointReportsMcp:workiq-sharepoint-reports-plugin.json";
  if (actionSignature !== expectedActionSignature) failures.push(`${packageSlug} has an invalid action set for its access level.`);
  if (existsSync(join(appPackagePath, "workiq-word-plugin.json"))) {
    const wordPlugin = JSON.parse(readFileSync(join(appPackagePath, "workiq-word-plugin.json"), "utf8"));
    const wordTool = wordPlugin.runtimes?.[0]?.spec?.mcp_tool_description?.tools?.[0];
    if (wordPlugin.runtimes?.length !== 1 || wordPlugin.runtimes[0]?.type !== "RemoteMCPServer" || wordPlugin.runtimes[0]?.run_for_functions?.join() !== "WordCreateNewDocument") failures.push(`${packageSlug} must pin only WordCreateNewDocument to the Work IQ Word action.`);
    if (wordPlugin.runtimes[0]?.auth?.type !== "OAuthPluginVault" || wordPlugin.runtimes[0]?.auth?.reference_id !== `\${{WORKIQ_WORD_AUTH_ID_${role.replaceAll("-", "_").toUpperCase()}}}`) failures.push(`${packageSlug} must use its package-local Work IQ Word auth binding.`);
    if (wordPlugin.runtimes[0]?.spec?.url !== "https://agent365.svc.cloud.microsoft/agents/tenants/${{WORKIQ_TENANT_ID}}/servers/mcp_WordServer" || wordTool?.name !== "WordCreateNewDocument") failures.push(`${packageSlug} has an invalid Work IQ Word endpoint or tool definition.`);
  }
  const reportStoragePlugin = {
    file: "workiq-sharepoint-reports-plugin.json",
    authPrefix: "WORKIQ_SHAREPOINT_REPORTS_AUTH_ID",
    endpoint: "https://agent365.svc.cloud.microsoft/agents/tenants/${{WORKIQ_TENANT_ID}}/servers/mcp_SharePointRemoteServer",
    tools: ["createSmallBinaryFile", "uploadFileFromUrl"]
  };
  const oneDriveConversionPlugin = {
    file: "workiq-onedrive-conversion-plugin.json",
    authPrefix: "WORKIQ_ONEDRIVE_CONVERSION_AUTH_ID",
    endpoint: "https://workiq.svc.cloud.microsoft/mcp",
    tools: ["fetch_blob_work_iq"]
  };
  for (const { file, authPrefix, endpoint, tools } of [oneDriveConversionPlugin, reportStoragePlugin]) {
    const pluginPath = join(appPackagePath, file);
    if (!existsSync(pluginPath)) continue;
    const readOnlyPlugin = JSON.parse(readFileSync(pluginPath, "utf8"));
    const runtime = readOnlyPlugin.runtimes?.[0];
    const declaredTools = runtime?.spec?.mcp_tool_description?.tools?.map((tool) => tool.name) ?? [];
    const functionNames = readOnlyPlugin.functions?.map((func) => func.name) ?? [];
    const expectedAuth = `\${{${authPrefix}_${role.replaceAll("-", "_").toUpperCase()}}}`;
    if (readOnlyPlugin.runtimes?.length !== 1 || runtime?.type !== "RemoteMCPServer" || JSON.stringify(runtime?.run_for_functions) !== JSON.stringify(tools) || JSON.stringify(declaredTools) !== JSON.stringify(tools) || JSON.stringify(functionNames) !== JSON.stringify(tools)) failures.push(`${packageSlug} must expose only the expected report-storage tool set.`);
    if (runtime?.auth?.type !== "OAuthPluginVault" || runtime?.auth?.reference_id !== expectedAuth) failures.push(`${packageSlug} must use its package-local auth binding for ${file}.`);
    if (runtime?.spec?.url !== endpoint) failures.push(`${packageSlug} has an invalid endpoint in ${file}.`);
  }
  for (const staleFile of ["workiq-sharepoint-plugin.json", "workiq-teams-plugin.json"]) {
    if (existsSync(join(appPackagePath, staleFile))) failures.push(`${packageSlug} must not expose stale general Work IQ access through ${staleFile}.`);
  }
  const yamlPath = join(packagePath, "m365agents.yml");
  if (!existsSync(yamlPath)) {
    failures.push(`${packageSlug} does not define its package-local lifecycle.`);
  } else {
    const lifecycle = readFileSync(yamlPath, "utf8");
    const sections = lifecycle.split(/^publish:\s*$/m);
    if (!sections[0].includes(metadata.dcrEnvironmentVariable)) failures.push(`${packageSlug} does not define its package-local DCR lifecycle.`);
    if (sections.length !== 2 || sections[0].includes("teamsApp/publishAppPackage") || !/teamsApp\/zipAppPackage[\s\S]*teamsApp\/validateAppPackage[\s\S]*teamsApp\/publishAppPackage/.test(sections[1])) failures.push(`${packageSlug} must publish only in a separate build/validate/submit stage.`);
    if (access === "read-only") {
      for (const authName of [`WORKIQ_WORD_AUTH_ID_${role.replaceAll("-", "_").toUpperCase()}`, `WORKIQ_ONEDRIVE_CONVERSION_AUTH_ID_${role.replaceAll("-", "_").toUpperCase()}`, `WORKIQ_SHAREPOINT_REPORTS_AUTH_ID_${role.replaceAll("-", "_").toUpperCase()}`]) {
        if (!sections[0].includes(authName)) failures.push(`${packageSlug} does not provision its package-local Work IQ auth binding ${authName}.`);
      }
    } else if (/oauth\/register/.test(sections[0])) {
      failures.push(`${packageSlug} must not provision Work IQ report-generation auth.`);
    }
  }
  for (const path of ["package.json", "README.md", ".gitignore", "scripts/generate-instructions.mjs", "scripts/validate-package.mjs"]) {
    if (!existsSync(join(packagePath, path))) failures.push(`${packageSlug} is missing ${path}.`);
  }
  if (excluded.test(readFileSync(manifestPath, "utf8")) || excluded.test(readFileSync(metadataPath, "utf8"))) failures.push(`${packageSlug} references an excluded write-capable role or tool.`);
}
for (const [name, variants] of iconVariants) {
  if (variants.size !== expected.size) failures.push(`All seven packages must have distinct ${name} artwork.`);
}

const legacyAgentDirectories = join(rootPath, "apps", "teams-project-manager-assistant", "appPackage", "agents");
if (existsSync(legacyAgentDirectories) && readdirSync(legacyAgentDirectories).length > 0) failures.push("Legacy multi-agent appPackage/agents directory must be removed.");
const coordinator = join(rootPath, "scripts", "manage-teams-packages.mjs");
const installPlan = spawnSync(process.execPath, [coordinator, "install", "--env", "dev"], { encoding: "utf8" });
const tenantSharePlan = spawnSync(process.execPath, [coordinator, "share-tenant", "--env", "dev"], { encoding: "utf8" });
const allPlan = spawnSync(process.execPath, [coordinator, "all", "--env", "dev"], { encoding: "utf8" });
const marketplace = join(rootPath, "scripts", "package-marketplace.mjs");
const marketplacePlan = spawnSync(process.execPath, [marketplace], { encoding: "utf8" });
const marketplaceWithoutIdentity = [...marketplacePackages].every((slug) => !existsSync(join(rootPath, "apps", slug, "env", ".env.prod")))
  ? spawnSync(process.execPath, [marketplace, "--execute"], { encoding: "utf8" })
  : null;
const installSteps = installPlan.stdout?.split("\n").filter((line) => line.startsWith("Dry run:") && line.includes(" - atk ")) ?? [];
const tenantShareSteps = tenantSharePlan.stdout?.split("\n").filter((line) => line.startsWith("Dry run:") && line.includes(" - atk ")) ?? [];
const marketplaceSteps = marketplacePlan.stdout?.split("\n").filter((line) => line.startsWith("Dry run:") && line.includes(" - atk ")) ?? [];
if (installPlan.status !== 0 || installSteps.length !== expected.size * 3 || [...expected.keys()].some((slug) => !installSteps.some((step) => step.includes(`${slug} - atk install --file-path ./appPackage/build/appPackage.dev.zip --scope Personal`))) || installSteps.some((step) => step.includes(" - atk package --env dev") && !step.includes("--manifest-file ./appPackage/manifest.dev.json"))) failures.push("Batch install must build, validate, and personally install all seven dev packages in a dry run.");
if (tenantSharePlan.status !== 0 || tenantShareSteps.length !== expected.size || [...expected.keys()].some((slug) => !tenantShareSteps.some((step) => step.includes(`${slug} - atk share --env dev --scope tenant`))) || tenantShareSteps.some((step) => step.includes(" - atk install "))) failures.push("Batch tenant sharing must share all seven without installing them.");
if (allPlan.status !== 0 || allPlan.stdout?.includes(" - atk install ") || allPlan.stdout?.includes(" - atk share ")) failures.push("Batch all mode must not implicitly install or share packages.");
if (marketplacePlan.status !== 0 || marketplaceSteps.length !== marketplacePackages.size * 2 || [...marketplacePackages].some((slug) => !marketplaceSteps.some((step) => step.includes(`${slug} - atk package --env prod`))) || [...expected.keys()].some((slug) => !marketplacePackages.has(slug) && marketplaceSteps.some((step) => step.includes(`${slug} - atk `))) || marketplaceSteps.some((step) => / - atk (?:publish|provision|share|install) /.test(step))) failures.push("Marketplace dry run must package and validate only the five separately configured production read-only agents.");
if (marketplaceWithoutIdentity && (marketplaceWithoutIdentity.status === 0 || !marketplaceWithoutIdentity.stderr?.includes("needs separate ignored prod and dev environments"))) failures.push("Marketplace packaging must fail before changes when production identity is absent.");
if (failures.length) throw new Error(`Teams package validation failed:\n- ${failures.join("\n- ")}`);
console.log("All seven PDS Project AI packages have role-scoped tools, guarded access instructions, and validated agent capabilities.");