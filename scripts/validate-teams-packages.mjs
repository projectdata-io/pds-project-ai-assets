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

for (const [packageSlug, role] of expected) {
  const packagePath = join(rootPath, "apps", packageSlug);
  const appPackagePath = join(packagePath, "appPackage");
  const metadataPath = join(packagePath, "source-metadata.json");
  const manifestPath = join(appPackagePath, "manifest.json");
  if (!existsSync(metadataPath) || !existsSync(manifestPath)) {
    failures.push(`${packageSlug} is missing source metadata or manifest.`);
    continue;
  }
  const metadata = JSON.parse(readFileSync(metadataPath, "utf8"));
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const entries = manifest.copilotAgents?.declarativeAgents ?? [];
  if (metadata.packageSlug !== packageSlug || metadata.role !== role || !/^MCP_DA_AUTH_ID_[A-Z_]+$/.test(metadata.dcrEnvironmentVariable) || typeof metadata.shortName !== "string" || metadata.shortName.length > 26 || typeof metadata.shortDescription !== "string" || metadata.shortDescription.length > 80) failures.push(`${packageSlug} has invalid package-local metadata.`);
  if (entries.length !== 1 || entries[0]?.id !== role || entries[0]?.file !== "declarativeAgent.json") failures.push(`${packageSlug} must expose exactly one local declarative agent.`);
  if (manifest.id !== "${{TEAMS_APP_ID}}") failures.push(`${packageSlug} must use its package-local Teams app placeholder.`);
  if (manifest.name?.short !== `${metadata.shortName} \${{APP_NAME_SUFFIX}}` || manifest.description?.short !== metadata.shortDescription) failures.push(`${packageSlug} does not use its Store display metadata.`);
  if (dcrVariables.has(metadata.dcrEnvironmentVariable)) failures.push(`${packageSlug} reuses a DCR environment variable.`);
  dcrVariables.add(metadata.dcrEnvironmentVariable);
  if (appIds.has(manifest.id) && manifest.id !== "${{TEAMS_APP_ID}}") failures.push(`${packageSlug} reuses a generated Teams app ID.`);
  appIds.add(manifest.id);
  for (const name of ["declarativeAgent.json", "instruction.txt", "ai-plugin.json", "color.png", "outline.png"]) {
    if (!existsSync(join(appPackagePath, name))) failures.push(`${packageSlug} is missing ${name}.`);
  }
  if (existsSync(join(appPackagePath, "instruction.txt"))) {
    const instruction = readFileSync(join(appPackagePath, "instruction.txt"), "utf8");
    if (!instruction.includes("SessionGone or SessionNotFound") || !instruction.includes("recreate a read-only session once") || !instruction.includes("continue paging") || !instruction.includes("Never describe a session as expired without an explicit session error")) failures.push(`${packageSlug} must recover from explicit session errors without inventing expiry.`);
    if (role === "mpp-data-auditor" && !instruction.includes("For progress consistency, retrieve every task page with the full task profile")) failures.push("MPP Data Auditor must retain progress audit coverage guidance.");
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
    if (!tools.includes("open_project_plan_picker") || !tools.includes("create_session_from_onedrive")) failures.push(`${packageSlug} lacks the shared picker/session flow.`);
    if (new Set(tools).size !== tools.length || tools.some((tool) => knownTools.get(tool) === "Session.ReadWrite" || writeTools.test(tool))) failures.push(`${packageSlug} exposes a write-capable MCP tool.`);
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
const installSteps = installPlan.stdout?.split("\n").filter((line) => line.startsWith("Dry run:") && line.includes(" - atk ")) ?? [];
const tenantShareSteps = tenantSharePlan.stdout?.split("\n").filter((line) => line.startsWith("Dry run:") && line.includes(" - atk ")) ?? [];
if (installPlan.status !== 0 || installSteps.length !== 15 || expected.keys().some((slug) => !installSteps.some((step) => step.includes(`${slug} - atk install --file-path ./appPackage/build/appPackage.dev.zip --scope Personal`)))) failures.push("Batch install must build, validate, and personally install all five packages in a dry run.");
if (tenantSharePlan.status !== 0 || tenantShareSteps.length !== 5 || expected.keys().some((slug) => !tenantShareSteps.some((step) => step.includes(`${slug} - atk share --env dev --scope tenant`))) || tenantShareSteps.some((step) => step.includes(" - atk install "))) failures.push("Batch tenant sharing must share all five without installing them.");
if (allPlan.status !== 0 || allPlan.stdout?.includes(" - atk install ") || allPlan.stdout?.includes(" - atk share ")) failures.push("Batch all mode must not implicitly install or share packages.");
if (failures.length) throw new Error(`Teams package validation failed:\n- ${failures.join("\n- ")}`);
console.log("All five ProjectData AI Essentials packages are isolated and read-only.");