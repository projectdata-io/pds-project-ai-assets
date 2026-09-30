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
  ["teams-mpp-data-auditor", "mpp-data-auditor"]
]);
const knownTools = new Map(JSON.parse(readFileSync(join(rootPath, "schemas", "mcp-tools.json"), "utf8")).tools.map((tool) => [tool.name, tool.scope]));
const writeTools = /(?:create_edit|add_edit|replace_edit|preview_edit|validate_edit|commit|update|delete|upload|new_project|draft)/i;
const excluded = /project-plan-editor|project-schedule-generator|Session\.ReadWrite|commit_edit_draft/i;
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
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const developmentManifest = JSON.parse(readFileSync(developmentManifestPath, "utf8"));
  const declarativeAgentPath = join(appPackagePath, "declarativeAgent.json");
  const developmentDeclarativeAgentPath = join(appPackagePath, "declarativeAgent.dev.json");
  const declarativeAgent = existsSync(declarativeAgentPath) ? JSON.parse(readFileSync(declarativeAgentPath, "utf8")) : {};
  const developmentDeclarativeAgent = existsSync(developmentDeclarativeAgentPath) ? JSON.parse(readFileSync(developmentDeclarativeAgentPath, "utf8")) : {};
  const expectedCapabilities = metadata.capabilities ?? [];
  const actualCapabilities = (declarativeAgent.capabilities ?? []).map((capability) => capability.name);
  if (JSON.stringify(actualCapabilities) !== JSON.stringify(expectedCapabilities)) failures.push(`${packageSlug} does not preserve its declared agent capabilities.`);
  const entries = manifest.copilotAgents?.declarativeAgents ?? [];
  if (metadata.packageSlug !== packageSlug || metadata.role !== role || !/^MCP_DA_AUTH_ID_[A-Z_]+$/.test(metadata.dcrEnvironmentVariable) || typeof metadata.shortName !== "string" || metadata.shortName.length > 26 || typeof metadata.shortDescription !== "string" || metadata.shortDescription.length > 80) failures.push(`${packageSlug} has invalid package-local metadata.`);
  if (entries.length !== 1 || entries[0]?.id !== role || entries[0]?.file !== "declarativeAgent.json") failures.push(`${packageSlug} must expose exactly one local declarative agent.`);
  const roleSuffix = role.replaceAll("-", "_").toUpperCase();
  const developmentWorkIqEnabled = [
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
  if (dcrVariables.has(metadata.dcrEnvironmentVariable)) failures.push(`${packageSlug} reuses a DCR environment variable.`);
  dcrVariables.add(metadata.dcrEnvironmentVariable);
  if (appIds.has(manifest.id) && manifest.id !== "${{TEAMS_APP_ID}}") failures.push(`${packageSlug} reuses a generated Teams app ID.`);
  appIds.add(manifest.id);
  for (const name of ["declarativeAgent.json", "declarativeAgent.dev.json", "instruction.txt", "instruction.dev.txt", "ai-plugin.json", "workiq-word-plugin.json", "workiq-onedrive-conversion-plugin.json", "workiq-sharepoint-reports-plugin.json", "color.png", "outline.png"]) {
    if (!existsSync(join(appPackagePath, name))) failures.push(`${packageSlug} is missing ${name}.`);
  }
  if (existsSync(join(appPackagePath, "instruction.txt"))) {
    const instruction = readFileSync(join(appPackagePath, "instruction.txt"), "utf8");
    if (!instruction.includes("SessionGone or SessionNotFound") || !instruction.includes("recreate a read-only session once") || !instruction.includes("continue paging") || !instruction.includes("Never describe a session as expired without an explicit session error")) failures.push(`${packageSlug} must recover from explicit session errors without inventing expiry.`);
    if (!instruction.includes("Use Microsoft Work IQ wherever the requested format and configured actions support it") || !instruction.includes("prefer creating the Word report with Work IQ")) failures.push(`${packageSlug} must prefer Work IQ for supported report formats.`);
    if (role === "mpp-data-auditor" && !instruction.includes("For progress consistency, retrieve every task page with the full task profile")) failures.push("MPP Data Auditor must retain progress audit coverage guidance.");
  }
  if (existsSync(join(appPackagePath, "instruction.dev.txt"))) {
    const developmentInstruction = readFileSync(join(appPackagePath, "instruction.dev.txt"), "utf8");
    if (!developmentInstruction.includes("execute file-generation code and return the resulting file as an attachment") || !developmentInstruction.includes("Do not return HTML, CSS, Python, ReportLab source, or a plan") || !developmentInstruction.includes("a citations section")) failures.push(`${packageSlug} must require executed, cited report-file attachments.`);
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
    if (!usesDynamicDiscovery && (!tools.includes("open_project_plan_picker") || !tools.includes("create_session_from_onedrive"))) failures.push(`${packageSlug} lacks the shared picker/session flow.`);
    if (new Set(tools).size !== tools.length || tools.some((tool) => knownTools.get(tool) === "Session.ReadWrite" || writeTools.test(tool))) failures.push(`${packageSlug} exposes a write-capable MCP tool.`);
  }
  const actionSignature = (declarativeAgent.actions ?? []).map((action) => `${action.id}:${action.file}`).join("|");
  if (actionSignature !== "pdsProjectAiMcp:ai-plugin.json|workIqWordMcp:workiq-word-plugin.json|workIqOneDriveConversionMcp:workiq-onedrive-conversion-plugin.json|workIqSharePointReportsMcp:workiq-sharepoint-reports-plugin.json") failures.push(`${packageSlug} must include the PDS, Word, OneDrive conversion, and scoped report-storage actions in that order.`);
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
  }
  for (const path of ["package.json", "README.md", ".gitignore", "scripts/generate-instructions.mjs", "scripts/validate-package.mjs"]) {
    if (!existsSync(join(packagePath, path))) failures.push(`${packageSlug} is missing ${path}.`);
  }
  if (excluded.test(readFileSync(manifestPath, "utf8")) || excluded.test(readFileSync(metadataPath, "utf8"))) failures.push(`${packageSlug} references an excluded write-capable role or tool.`);
}
for (const [name, variants] of iconVariants) {
  if (variants.size !== expected.size) failures.push(`All five packages must have distinct ${name} artwork.`);
}

const legacyAgentDirectories = join(rootPath, "apps", "teams-project-manager-assistant", "appPackage", "agents");
if (existsSync(legacyAgentDirectories) && readdirSync(legacyAgentDirectories).length > 0) failures.push("Legacy multi-agent appPackage/agents directory must be removed.");
const coordinator = join(rootPath, "scripts", "manage-teams-packages.mjs");
const installPlan = spawnSync(process.execPath, [coordinator, "install", "--env", "dev"], { encoding: "utf8" });
const tenantSharePlan = spawnSync(process.execPath, [coordinator, "share-tenant", "--env", "dev"], { encoding: "utf8" });
const allPlan = spawnSync(process.execPath, [coordinator, "all", "--env", "dev"], { encoding: "utf8" });
const marketplace = join(rootPath, "scripts", "package-marketplace.mjs");
const marketplacePlan = spawnSync(process.execPath, [marketplace], { encoding: "utf8" });
const marketplaceWithoutIdentity = [...expected.keys()].every((slug) => !existsSync(join(rootPath, "apps", slug, "env", ".env.prod")))
  ? spawnSync(process.execPath, [marketplace, "--execute"], { encoding: "utf8" })
  : null;
const installSteps = installPlan.stdout?.split("\n").filter((line) => line.startsWith("Dry run:") && line.includes(" - atk ")) ?? [];
const tenantShareSteps = tenantSharePlan.stdout?.split("\n").filter((line) => line.startsWith("Dry run:") && line.includes(" - atk ")) ?? [];
const marketplaceSteps = marketplacePlan.stdout?.split("\n").filter((line) => line.startsWith("Dry run:") && line.includes(" - atk ")) ?? [];
if (installPlan.status !== 0 || installSteps.length !== 15 || expected.keys().some((slug) => !installSteps.some((step) => step.includes(`${slug} - atk install --file-path ./appPackage/build/appPackage.dev.zip --scope Personal`))) || installSteps.some((step) => step.includes(" - atk package --env dev") && !step.includes("--manifest-file ./appPackage/manifest.dev.json"))) failures.push("Batch install must build, validate, and personally install all five PDS-only dev packages in a dry run.");
if (tenantSharePlan.status !== 0 || tenantShareSteps.length !== 5 || expected.keys().some((slug) => !tenantShareSteps.some((step) => step.includes(`${slug} - atk share --env dev --scope tenant`))) || tenantShareSteps.some((step) => step.includes(" - atk install "))) failures.push("Batch tenant sharing must share all five without installing them.");
if (allPlan.status !== 0 || allPlan.stdout?.includes(" - atk install ") || allPlan.stdout?.includes(" - atk share ")) failures.push("Batch all mode must not implicitly install or share packages.");
if (marketplacePlan.status !== 0 || marketplaceSteps.length !== 10 || expected.keys().some((slug) => !marketplaceSteps.some((step) => step.includes(`${slug} - atk package --env prod`))) || marketplaceSteps.some((step) => / - atk (?:publish|provision|share|install) /.test(step))) failures.push("Marketplace dry run must only package and validate five production agents.");
if (marketplaceWithoutIdentity && (marketplaceWithoutIdentity.status === 0 || !marketplaceWithoutIdentity.stderr?.includes("needs separate ignored prod and dev environments"))) failures.push("Marketplace packaging must fail before changes when production identity is absent.");
if (failures.length) throw new Error(`Teams package validation failed:\n- ${failures.join("\n- ")}`);
console.log("All five PDS Project AI packages are isolated and read-only.");