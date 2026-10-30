import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { strFromU8, unzipSync } from "fflate";

const rootPath = fileURLToPath(new URL("../", import.meta.url));
const allPackages = [
  "teams-project-manager-assistant",
  "teams-mpp-data-auditor",
  "teams-project-plan-editor",
  "teams-project-schedule-generator"
];
const activePublishedPackages = allPackages;
const releaseManifestPath = join(rootPath, "dist", "teams-package-release.json");
const rawArgs = process.argv.slice(2);
const mode = rawArgs[0];
const usage = "Usage: node scripts/manage-teams-packages.mjs <prepare|provision|install|share-tenant|publish|all> --env dev [--execute] [--package <name>] [--packages <names>] [--all-packages] [--portal-verified]";

function artifactInfo(packageName) {
  const zipPath = join(rootPath, "apps", packageName, "appPackage", "build", "appPackage.dev.zip");
  if (!existsSync(zipPath)) throw new Error(`Missing prepared ZIP for ${packageName}; run the prepare stage first.`);
  const bytes = readFileSync(zipPath);
  const archive = unzipSync(bytes);
  if (!archive["manifest.json"]) throw new Error(`${packageName} ZIP has no manifest.json.`);
  const manifest = JSON.parse(strFromU8(archive["manifest.json"]));
  if (typeof manifest.id !== "string" || typeof manifest.version !== "string") {
    throw new Error(`${packageName} ZIP has no concrete app ID and version.`);
  }
  return {
    packageName,
    path: relative(rootPath, zipPath).replaceAll("\\", "/"),
    appId: manifest.id,
    version: manifest.version,
    sha256: createHash("sha256").update(bytes).digest("hex")
  };
}

function captureSourceProvenance() {
  const commitResult = spawnSync("git", ["rev-parse", "HEAD"], { cwd: rootPath, encoding: "utf8" });
  const statusResult = spawnSync("git", ["status", "--porcelain=v1", "--untracked-files=all"], { cwd: rootPath, encoding: "utf8" });
  if (commitResult.error) throw commitResult.error;
  if (statusResult.error) throw statusResult.error;
  if (commitResult.status !== 0 || statusResult.status !== 0) throw new Error("Unable to capture source commit and dirty-tree state for the prepared release.");
  const changes = statusResult.stdout.trim().split(/\r?\n/).filter(Boolean);
  return { commit: commitResult.stdout.trim(), dirty: changes.length > 0, changes };
}

function freezePreparedPackages(packages) {
  const manifest = { schemaVersion: 1, preparedAtUtc: new Date().toISOString(), source: captureSourceProvenance(), packages: packages.map(artifactInfo) };
  mkdirSync(join(rootPath, "dist"), { recursive: true });
  writeFileSync(releaseManifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`Source commit: ${manifest.source.commit}; dirty tree: ${manifest.source.dirty}`);
  for (const change of manifest.source.changes) console.log(`Source change: ${change}`);
  for (const artifact of manifest.packages) {
    console.log(`${artifact.packageName}: app ${artifact.appId}, version ${artifact.version}, SHA-256 ${artifact.sha256}`);
  }
  console.log(`Frozen release record: ${relative(rootPath, releaseManifestPath).replaceAll("\\", "/")}`);
}

function verifyFrozenPackages(packages) {
  if (!existsSync(releaseManifestPath)) throw new Error("No frozen release record; run the prepare stage first.");
  const frozen = JSON.parse(readFileSync(releaseManifestPath, "utf8"));
  if (frozen.schemaVersion !== 1 || !/^[0-9a-f]{40}$/i.test(frozen.source?.commit ?? "") || typeof frozen.source?.dirty !== "boolean" || !Array.isArray(frozen.source?.changes) || !Array.isArray(frozen.packages)) throw new Error("Frozen release record is invalid or missing source provenance.");
  for (const packageName of packages) {
    const expected = frozen.packages.find((entry) => entry.packageName === packageName);
    if (!expected) throw new Error(`${packageName} is not in the frozen release; prepare the intended package selection.`);
    const actual = artifactInfo(packageName);
    if (actual.path !== expected.path || actual.appId !== expected.appId || actual.version !== expected.version || actual.sha256 !== expected.sha256) {
      throw new Error(`${packageName} ZIP differs from the frozen release. Do not publish or retry it; synchronize and prepare a new release.`);
    }
  }
}

function runToolkit(packageName, command) {
  const folder = join(rootPath, "apps", packageName);
  const result = spawnSync("npx", ["--yes", "@microsoft/m365agentstoolkit-cli@beta", ...command], {
    cwd: folder,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, ATK_CLI_SKILL: "true" }
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Stopped after ${packageName} ${command[0]} failed; later packages were not changed.`);
}

let envValue;
let execute = false;
let includeAll = false;
let portalVerified = false;
let explicitPackages;

for (let i = 1; i < rawArgs.length; i++) {
  const arg = rawArgs[i];
  if (arg === "--env") {
    envValue = rawArgs[++i];
  } else if (arg === "--execute") {
    execute = true;
  } else if (arg === "--all-packages") {
    includeAll = true;
  } else if (arg === "--portal-verified") {
    portalVerified = true;
  } else if (arg === "--package") {
    const pkg = rawArgs[++i];
    if (!pkg || pkg.startsWith("--") || !pkg.trim()) throw new Error("--package requires a non-empty package name.");
    explicitPackages = [pkg.trim()];
  } else if (arg === "--packages") {
    const pkgs = rawArgs[++i];
    if (!pkgs || pkgs.startsWith("--") || !pkgs.trim()) throw new Error("--packages requires a comma-separated list of package names.");
    explicitPackages = pkgs.split(",").map((s) => s.trim());
    if (explicitPackages.some((pkg) => !pkg)) throw new Error("--packages cannot contain empty package names.");
  } else {
    console.error(`Unknown argument: ${arg}\n${usage}`);
    process.exit(1);
  }
}

if (!["prepare", "provision", "install", "share-tenant", "publish", "all"].includes(mode) || envValue !== "dev") {
  console.error(usage);
  process.exitCode = 1;
} else if (execute && mode === "all") {
  throw new Error("all --execute is disabled because provisioning rebuilds packages; run prepare, Developer Portal synchronization, and publish as separate stages.");
} else {
  const publicationPackages = explicitPackages ?? (includeAll ? allPackages : activePublishedPackages);
  const packagesToCheck = mode === "prepare" || mode === "publish" ? publicationPackages : explicitPackages ?? allPackages;
  for (const packageName of packagesToCheck) {
    const folder = join(rootPath, "apps", packageName);
    if (!existsSync(join(folder, "m365agents.yml"))) throw new Error(`Missing Toolkit lifecycle for ${packageName}`);
  }

  if (execute && mode === "publish") {
    if (!portalVerified) throw new Error("Before publishing, synchronize each exact frozen ZIP to its existing Developer Portal app and verify its app ID/version; then pass --portal-verified.");
    verifyFrozenPackages(publicationPackages);
  }

  if (mode === "prepare") {
    const commands = [
      ["package", "--env", "dev", "--manifest-file", "./appPackage/manifest.json", "--interactive", "false"],
      ["validate", "--env", "dev", "--manifest-file", "./appPackage/manifest.json", "--interactive", "false"]
    ];
    for (const packageName of publicationPackages) {
      for (const command of commands) {
        console.log(`${execute ? "Running" : "Dry run"}: ${packageName} - atk ${command.join(" ")}`);
        if (execute) runToolkit(packageName, command);
      }
    }
    if (execute) freezePreparedPackages(publicationPackages);
  } else {
    const stages = mode === "all" ? ["provision", "publish"] : [mode];
    for (const stage of stages) {
      const targetPackages = explicitPackages
        ? explicitPackages
        : stage === "publish" && !includeAll
          ? activePublishedPackages
          : allPackages;

      for (const packageName of targetPackages) {
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
          if (execute) runToolkit(packageName, command);
        }
      }
    }
  }
}