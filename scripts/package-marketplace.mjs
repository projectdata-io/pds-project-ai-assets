import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";

const rootPath = fileURLToPath(new URL("../", import.meta.url));
const packages = [
  "teams-project-manager-assistant",
  "teams-schedule-quality-analyst",
  "teams-portfolio-executive-analyst",
  "teams-resource-manager",
  "teams-mpp-data-auditor"
];
const execute = process.argv.slice(2).includes("--execute");
const prepareOnly = process.argv.slice(2).includes("--prepare");
if ((execute && prepareOnly) || process.argv.slice(2).some((argument) => argument !== "--execute" && argument !== "--prepare")) {
  throw new Error("Usage: node scripts/package-marketplace.mjs [--prepare|--execute]");
}

const identities = packages.map((packageName) => {
  const folder = join(rootPath, "apps", packageName);
  if (!execute) return { packageName, folder };
  const productionPath = join(folder, "env", ".env.prod");
  const developmentPath = join(folder, "env", ".env.dev");
  if (!existsSync(productionPath) || !existsSync(developmentPath)) {
    throw new Error(`${packageName} needs separate ignored prod and dev environments before packaging.`);
  }
  const production = parseEnv(readFileSync(productionPath, "utf8"));
  const development = parseEnv(readFileSync(developmentPath, "utf8"));
  const { dcrEnvironmentVariable } = JSON.parse(readFileSync(join(folder, "source-metadata.json"), "utf8"));
  if (production.TEAMSFX_ENV !== "prod" || production.APP_NAME_SUFFIX !== "" ||
      !production.TEAMS_APP_ID || !production[dcrEnvironmentVariable] ||
      production.TEAMS_APP_ID === development.TEAMS_APP_ID ||
      production[dcrEnvironmentVariable] === development[dcrEnvironmentVariable]) {
    throw new Error(`${packageName} needs a distinct production Teams app and cross-tenant PDS auth registration, with an empty name suffix.`);
  }
  return { packageName, folder, production, development, dcrEnvironmentVariable };
});

if (execute) {
  const developmentIds = new Set(identities.map(({ development }) => development.TEAMS_APP_ID));
  const developmentAuthIds = new Set(identities.map(({ development, dcrEnvironmentVariable }) => development[dcrEnvironmentVariable]));
  const productionIds = identities.map(({ production }) => production.TEAMS_APP_ID);
  const productionAuthIds = identities.map(({ production, dcrEnvironmentVariable }) => production[dcrEnvironmentVariable]);
  if (new Set(productionIds).size !== packages.length || new Set(productionAuthIds).size !== packages.length ||
      productionIds.some((id) => developmentIds.has(id)) || productionAuthIds.some((id) => developmentAuthIds.has(id))) {
    throw new Error("Production Teams app and PDS auth IDs must be unique and must not reuse any dev ID.");
  }
}

for (const { packageName, folder, production, dcrEnvironmentVariable } of identities) {
  const commands = ["package", "validate"];
  if (execute || prepareOnly) {
    const sourcePath = join(folder, "appPackage");
    const marketplacePath = join(sourcePath, "build", "marketplace");
    mkdirSync(marketplacePath, { recursive: true });
    const manifest = JSON.parse(readFileSync(join(sourcePath, "manifest.json"), "utf8"));
    const agent = JSON.parse(readFileSync(join(sourcePath, "declarativeAgent.json"), "utf8"));
    const metadata = JSON.parse(readFileSync(join(folder, "source-metadata.json"), "utf8"));
    manifest.name.short = metadata.shortName;
    manifest.name.full = metadata.title;
    agent.name = metadata.title;
    writeFileSync(join(marketplacePath, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    writeFileSync(join(marketplacePath, "declarativeAgent.json"), `${JSON.stringify(agent, null, 2)}\n`);
    for (const name of ["ai-plugin.json", "instruction.txt", "color.png", "outline.png"]) {
      copyFileSync(join(sourcePath, name), join(marketplacePath, name));
    }
  }
  if (prepareOnly) {
    console.log(`Prepared local Marketplace template: ${packageName}`);
    continue;
  }
  for (const command of commands) {
    const manifestOption = command === "package" ? " --manifest-file ./appPackage/build/marketplace/manifest.json" : "";
    console.log(`${execute ? "Running" : "Dry run"}: ${packageName} - atk ${command} --env prod --interactive false${manifestOption}`);
    if (!execute) continue;
    const args = ["--yes", "@microsoft/m365agentstoolkit-cli@beta", command, "--env", "prod", "--interactive", "false"];
    if (command === "package") args.push("--manifest-file", "./appPackage/build/marketplace/manifest.json");
    const result = spawnSync("npx", args, {
      cwd: folder,
      stdio: "inherit",
      shell: process.platform === "win32",
      env: { ...process.env, ATK_CLI_SKILL: "true" }
    });
    if (result.error) throw result.error;
    if (result.status !== 0) {
      throw new Error(`Stopped after ${packageName} ${command} failed; later packages were not packaged.`);
    }
  }
  if (execute) {
    const manifest = JSON.parse(readFileSync(join(folder, "appPackage", "build", "manifest.prod.json"), "utf8"));
    const agent = JSON.parse(readFileSync(join(folder, "appPackage", "build", "declarativeAgent.prod.json"), "utf8"));
    const plugin = JSON.parse(readFileSync(join(folder, "appPackage", "build", "ai-plugin.prod.json"), "utf8"));
    if (manifest.id !== production.TEAMS_APP_ID || manifest.name.short !== manifest.name.short.trim() ||
      agent.name !== agent.name.trim() || /\bdev\b/i.test(`${manifest.name.short} ${manifest.name.full} ${agent.name}`) ||
      plugin.runtimes?.[0]?.auth?.reference_id !== production[dcrEnvironmentVariable] ||
        !existsSync(join(folder, "appPackage", "build", "appPackage.prod.zip"))) {
      throw new Error(`${packageName} production package has mismatched identity, dev branding, or unresolved auth.`);
    }
  }
}