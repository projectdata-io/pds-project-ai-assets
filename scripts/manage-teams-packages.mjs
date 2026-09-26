import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const rootPath = fileURLToPath(new URL("../", import.meta.url));
const packages = [
  "teams-project-manager-assistant",
  "teams-schedule-quality-analyst",
  "teams-portfolio-executive-analyst",
  "teams-resource-manager",
  "teams-mpp-data-auditor"
];
const [mode, ...options] = process.argv.slice(2);
const usage = "Usage: node scripts/manage-teams-packages.mjs <provision|install|share-tenant|publish|all> --env dev [--execute]";

if (!["provision", "install", "share-tenant", "publish", "all"].includes(mode) || options.some((option) => !["--env", "dev", "--execute"].includes(option)) || options.indexOf("--env") < 0 || options[options.indexOf("--env") + 1] !== "dev") {
  console.error(usage);
  process.exitCode = 1;
} else {
  const execute = options.includes("--execute");
  const stages = mode === "all" ? ["provision", "publish"] : [mode];
  for (const packageName of packages) {
    const folder = join(rootPath, "apps", packageName);
    if (!existsSync(join(folder, "m365agents.yml"))) {
      throw new Error(`Missing Toolkit lifecycle for ${packageName}`);
    }
  }

  for (const stage of stages) {
    for (const packageName of packages) {
      const folder = join(rootPath, "apps", packageName);
      const commands = stage === "install"
        ? [
            ["package", "--env", "dev", "--interactive", "false"],
            ["validate", "--env", "dev", "--interactive", "false"],
            ["install", "--file-path", "./appPackage/build/appPackage.dev.zip", "--scope", "Personal", "--interactive", "false"]
          ]
        : stage === "share-tenant"
          ? [["share", "--env", "dev", "--scope", "tenant", "--interactive", "false"]]
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