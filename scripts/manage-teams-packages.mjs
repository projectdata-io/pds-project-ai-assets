import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const rootPath = fileURLToPath(new URL("../", import.meta.url));
const allPackages = [
  "teams-project-manager-assistant",
  "teams-schedule-quality-analyst",
  "teams-portfolio-executive-analyst",
  "teams-resource-manager",
  "teams-mpp-data-auditor",
  "teams-project-plan-editor",
  "teams-project-schedule-generator"
];
const activePublishedPackages = [
  "teams-project-manager-assistant",
  "teams-mpp-data-auditor",
  "teams-project-plan-editor",
  "teams-project-schedule-generator"
];
const rawArgs = process.argv.slice(2);
const mode = rawArgs[0];
const usage = "Usage: node scripts/manage-teams-packages.mjs <provision|install|share-tenant|publish|all> --env dev [--execute] [--package <name>] [--packages <names>] [--all-packages]";

function runNodeScript(scriptName) {
  const result = spawnSync(process.execPath, [join(rootPath, "scripts", scriptName)], { stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${scriptName} failed with exit code ${result.status ?? 1}.`);
}

let envValue;
let execute = false;
let includeAll = false;
let explicitPackages;

for (let i = 1; i < rawArgs.length; i++) {
  const arg = rawArgs[i];
  if (arg === "--env") {
    envValue = rawArgs[++i];
  } else if (arg === "--execute") {
    execute = true;
  } else if (arg === "--all-packages") {
    includeAll = true;
  } else if (arg === "--package") {
    const pkg = rawArgs[++i];
    if (pkg) explicitPackages = [pkg.trim()];
  } else if (arg === "--packages") {
    const pkgs = rawArgs[++i];
    if (pkgs) explicitPackages = pkgs.split(",").map((s) => s.trim()).filter(Boolean);
  } else {
    console.error(`Unknown argument: ${arg}\n${usage}`);
    process.exit(1);
  }
}

if (!["provision", "install", "share-tenant", "publish", "all"].includes(mode) || envValue !== "dev") {
  console.error(usage);
  process.exitCode = 1;
} else {
  const stages = mode === "all" ? ["provision", "publish"] : [mode];
  if (execute && (mode === "publish" || mode === "all")) {
    runNodeScript("bump-teams-package-versions.mjs");
    runNodeScript("generate-teams-packages.mjs");
  }
  const packagesToCheck = explicitPackages ?? allPackages;
  for (const packageName of packagesToCheck) {
    const folder = join(rootPath, "apps", packageName);
    if (!existsSync(join(folder, "m365agents.yml"))) {
      throw new Error(`Missing Toolkit lifecycle for ${packageName}`);
    }
  }

  for (const stage of stages) {
    const targetPackages = explicitPackages
      ? explicitPackages
      : stage === "publish" && !includeAll
      ? activePublishedPackages
      : allPackages;

    for (const packageName of targetPackages) {
      const folder = join(rootPath, "apps", packageName);
      const commands = stage === "install"
        ? [
            ["package", "--env", "dev", "--manifest-file", "./appPackage/manifest.json", "--interactive", "false"],
            ["validate", "--env", "dev", "--manifest-file", "./appPackage/manifest.json", "--interactive", "false"],
            ["install", "--file-path", "./appPackage/build/appPackage.dev.zip", "--scope", "Personal", "--interactive", "false"]
          ]
        : stage === "share-tenant"
          ? [["share", "--env", "dev", "--scope", "tenant", "--interactive", "false"]]
        : stage === "publish"
          ? [["publish", "--env", "dev", "--manifest-file", "./appPackage/manifest.json", "--interactive", "false"]]
          : [[stage, "--env", "dev", "--interactive", "false"]];
      for (const command of commands) {
        console.log(`${execute ? "Running" : "Dry run"}: ${packageName} - atk ${command.join(" ")}`);
        if (!execute) continue;

        const result = spawnSync("npx", ["--yes", "@microsoft/m365agentstoolkit-cli@beta", ...command], { cwd: folder, stdio: "inherit", shell: process.platform === "win32", env: { ...process.env, ATK_CLI_SKILL: "true" } });
        if (result.error) throw result.error;
        if (result.status !== 0) {
          console.error(`Stopped after ${packageName} ${command[0]} failed; later packages were not changed.`);
          process.exitCode = result.status ?? 1;
          break;
        }
      }
      if (process.exitCode) break;
    }
    if (process.exitCode) break;
  }
}