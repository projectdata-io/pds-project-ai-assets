import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const rootPath = fileURLToPath(new URL("../", import.meta.url));
const packageSlugs = [
  "teams-project-manager-assistant",
  "teams-schedule-quality-analyst",
  "teams-portfolio-executive-analyst",
  "teams-resource-manager",
  "teams-mpp-data-auditor",
  "teams-project-plan-editor",
  "teams-project-schedule-generator"
];

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function incrementPatch(version, packageSlug) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) throw new Error(`${packageSlug} has an invalid package version: ${version}`);
  return `${match[1]}.${match[2]}.${Number(match[3]) + 1}`;
}

const nextVersions = packageSlugs.map((packageSlug) => {
  const metadataPath = join(rootPath, "apps", packageSlug, "source-metadata.json");
  const metadata = readJson(metadataPath);
  const previousVersion = metadata.version;
  const nextVersion = incrementPatch(previousVersion, packageSlug);
  metadata.version = nextVersion;
  writeJson(metadataPath, metadata);
  return `${packageSlug}: ${previousVersion} -> ${nextVersion}`;
});

console.log(nextVersions.join("\n"));