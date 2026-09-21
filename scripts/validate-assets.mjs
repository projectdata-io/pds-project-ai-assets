import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const rootPath = fileURLToPath(root);
const requiredDirectories = ["agents", "examples", "prompts", "schemas", "skills", "templates"];
const failures = [];
const excludedDirectories = new Set([".git", "node_modules"]);
const prohibitedExtensions = new Set([".cer", ".crt", ".key", ".mpp", ".mpt", ".p12", ".pem", ".pfx"]);
const prohibitedFileNames = [/^\.env(?:\..+)?$/i, /^credentials.*\.json$/i, /^secrets.*\.json$/i];
const prohibitedContent = [
  { pattern: /\b[A-Za-z]:\\(?:Users|Documents and Settings)\\/i, reason: "local Windows path" },
  { pattern: /\/(?:Users|home)\/[^/\s]+\//, reason: "local Unix path" },
  { pattern: /-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----/, reason: "private key material" }
];

function visitFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory)) {
    if (excludedDirectories.has(entry)) {
      continue;
    }

    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      files.push(...visitFiles(path));
    } else {
      files.push(path);
    }
  }
  return files;
}

for (const directory of requiredDirectories) {
  if (!existsSync(join(rootPath, directory))) {
    failures.push(`Missing required directory: ${directory}`);
  }
}

const skillsDirectory = join(rootPath, "skills");
if (existsSync(skillsDirectory)) {
  for (const entry of readdirSync(skillsDirectory)) {
    const skillDirectory = join(skillsDirectory, entry);
    if (!statSync(skillDirectory).isDirectory()) {
      continue;
    }

    const skillFile = join(skillDirectory, "SKILL.md");
    if (!existsSync(skillFile)) {
      failures.push(`Skill ${entry} is missing SKILL.md`);
      continue;
    }

    const content = readFileSync(skillFile, "utf8");
    const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!frontmatter) {
      failures.push(`Skill ${entry} has no YAML frontmatter`);
      continue;
    }

    const name = frontmatter[1].match(/^name:\s*["']?([^"'\r\n]+)["']?\s*$/m)?.[1]?.trim();
    const description = frontmatter[1].match(/^description:\s*(.+)$/m)?.[1]?.trim();
    if (name !== entry) {
      failures.push(`Skill ${entry} declares name ${name ?? "<missing>"}`);
    }
    if (!description) {
      failures.push(`Skill ${entry} has no description`);
    }
  }
}

for (const file of visitFiles(rootPath)) {
  const repositoryPath = relative(rootPath, file).replaceAll("\\", "/");
  const fileName = repositoryPath.split("/").at(-1) ?? repositoryPath;
  if (prohibitedExtensions.has(extname(fileName).toLowerCase()) || prohibitedFileNames.some((pattern) => pattern.test(fileName))) {
    failures.push(`Prohibited public artifact: ${repositoryPath}`);
    continue;
  }

  const content = readFileSync(file, "utf8");
  for (const rule of prohibitedContent) {
    if (rule.pattern.test(content)) {
      failures.push(`Potential ${rule.reason} in ${repositoryPath}`);
    }
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Asset structure is valid.");
}