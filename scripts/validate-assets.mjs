import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const rootPath = fileURLToPath(root);
const requiredDirectories = ["agents", "examples", "prompts", "schemas", "skills", "templates"];
const failures = [];
const excludedDirectories = new Set([".git", "build", "dist", "node_modules"]);
const prohibitedExtensions = new Set([".cer", ".crt", ".key", ".mpp", ".mpt", ".p12", ".pem", ".pfx"]);
const prohibitedFileNames = [/^\.env(?:\..+)?$/i, /^credentials.*\.json$/i, /^secrets.*\.json$/i];
const skillCategories = new Set(["analysis", "audit", "editing", "portfolio", "reporting"]);
const skillAccessLevels = new Set(["read-only", "draft-only", "commit"]);
const agentAccessLevels = new Set(["read-only", "commit"]);
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

function loadJson(repositoryPath) {
  const path = join(rootPath, repositoryPath);
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    failures.push(`Invalid JSON in ${repositoryPath}: ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  }
}

function sortedUnique(values) {
  return [...new Set(values)].sort();
}

function sameValues(left, right) {
  return JSON.stringify(sortedUnique(left)) === JSON.stringify(sortedUnique(right));
}

for (const directory of requiredDirectories) {
  if (!existsSync(join(rootPath, directory))) {
    failures.push(`Missing required directory: ${directory}`);
  }
}

const skillsDirectory = join(rootPath, "skills");
const skillFiles = new Map();
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
    skillFiles.set(entry, content);
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

const contract = loadJson("schemas/mcp-tools.json");
const contractTools = new Map();
if (!contract || !Array.isArray(contract.tools)) {
  failures.push("MCP tool manifest must contain a tools array");
} else {
  for (const tool of contract.tools) {
    if (!tool || typeof tool.name !== "string" || !["Session.ReadOnly", "Session.ReadWrite"].includes(tool.scope)) {
      failures.push("MCP tool manifest contains an invalid tool entry");
      continue;
    }
    if (contractTools.has(tool.name)) {
      failures.push(`Duplicate MCP tool in manifest: ${tool.name}`);
    }
    contractTools.set(tool.name, tool.scope);
  }
}

const catalog = loadJson("catalog.json");
const catalogSkills = new Map();
const catalogAgents = new Map();
if (!catalog || !Array.isArray(catalog.skills) || !Array.isArray(catalog.agents)) {
  failures.push("Catalog must contain skills and agents arrays");
} else {
  for (const skill of catalog.skills) {
    if (!skill || typeof skill.name !== "string" || !skillCategories.has(skill.category) || !skillAccessLevels.has(skill.access)) {
      failures.push("Catalog contains an invalid skill entry");
      continue;
    }
    if (catalogSkills.has(skill.name)) {
      failures.push(`Duplicate catalog skill: ${skill.name}`);
      continue;
    }
    catalogSkills.set(skill.name, skill);

    if (!Array.isArray(skill.tools) || !Array.isArray(skill.agents)) {
      failures.push(`Catalog skill ${skill.name} must declare tools and agents arrays`);
      continue;
    }
    for (const tool of skill.tools) {
      if (!contractTools.has(tool)) {
        failures.push(`Catalog skill ${skill.name} references unknown MCP tool ${tool}`);
      }
      if (skill.access === "read-only" && contractTools.get(tool) === "Session.ReadWrite") {
        failures.push(`Read-only skill ${skill.name} references write tool ${tool}`);
      }
      if (skill.access === "draft-only" && tool === "commit_edit_draft") {
        failures.push(`Draft-only skill ${skill.name} references commit_edit_draft`);
      }
    }

    const skillContent = skillFiles.get(skill.name);
    if (!skillContent) {
      failures.push(`Catalog skill ${skill.name} has no skills/${skill.name}/SKILL.md`);
      continue;
    }
    const toolLine = skillContent.match(/^- Tools:\s*(.+)$/m)?.[1] ?? "";
    const declaredTools = [...toolLine.matchAll(/`([a-z][a-z0-9_]*)`/g)].map((match) => match[1]);
    if (!sameValues(skill.tools, declaredTools)) {
      failures.push(`Catalog tools do not match SKILL.md declaration for ${skill.name}`);
    }
  }

  for (const skillName of skillFiles.keys()) {
    if (!catalogSkills.has(skillName)) {
      failures.push(`Skill ${skillName} is missing from catalog.json`);
    }
  }

  for (const agent of catalog.agents) {
    if (!agent || typeof agent.name !== "string" || !agentAccessLevels.has(agent.access) || typeof agent.path !== "string") {
      failures.push("Catalog contains an invalid agent entry");
      continue;
    }
    if (catalogAgents.has(agent.name)) {
      failures.push(`Duplicate catalog agent: ${agent.name}`);
      continue;
    }
    catalogAgents.set(agent.name, agent);

    const metadataPath = `${agent.path}/agent.json`;
    const instructionsPath = join(rootPath, agent.path, "instructions.md");
    const metadata = loadJson(metadataPath);
    if (!metadata || metadata.name !== agent.name || metadata.access !== agent.access || !Array.isArray(metadata.skills)) {
      failures.push(`Agent metadata does not match catalog for ${agent.name}`);
      continue;
    }
    if (!existsSync(instructionsPath)) {
      failures.push(`Agent ${agent.name} is missing instructions.md`);
    }

    const mappedSkills = catalog.skills.filter((skill) => skill.agents.includes(agent.name)).map((skill) => skill.name);
    if (!sameValues(metadata.skills, mappedSkills)) {
      failures.push(`Agent skill mapping does not match catalog for ${agent.name}`);
    }
    for (const skillName of metadata.skills) {
      const skill = catalogSkills.get(skillName);
      if (!skill) {
        failures.push(`Agent ${agent.name} references unknown skill ${skillName}`);
      } else if (agent.access === "read-only" && skill.access !== "read-only") {
        failures.push(`Read-only agent ${agent.name} references ${skill.access} skill ${skillName}`);
      }
    }
  }

  for (const skill of catalog.skills) {
    for (const agentName of skill.agents) {
      if (!catalogAgents.has(agentName)) {
        failures.push(`Skill ${skill.name} references unknown agent ${agentName}`);
      }
    }
  }
}

const commitSkills = [...catalogSkills.values()].filter((skill) => skill.tools.includes("commit_edit_draft"));
if (commitSkills.length !== 1 || commitSkills[0]?.name !== "mpp-safe-commit" || commitSkills[0]?.access !== "commit") {
  failures.push("mpp-safe-commit must be the only catalog skill allowed to call commit_edit_draft");
}

const readme = readFileSync(join(rootPath, "README.md"), "utf8");
for (const skillName of catalogSkills.keys()) {
  if (!readme.includes(`skills/${skillName}/SKILL.md`)) {
    failures.push(`README catalog is missing skill ${skillName}`);
  }
}

const evaluations = loadJson("examples/evaluations.json");
const evaluationIds = new Set();
if (!evaluations || !Array.isArray(evaluations.cases)) {
  failures.push("Synthetic evaluations must contain a cases array");
} else {
  for (const evaluation of evaluations.cases) {
    if (
      !evaluation ||
      typeof evaluation.id !== "string" ||
      typeof evaluation.agent !== "string" ||
      typeof evaluation.prompt !== "string" ||
      !Array.isArray(evaluation.expectedSkills) ||
      !Array.isArray(evaluation.forbiddenTools)
    ) {
      failures.push("Synthetic evaluations contain an invalid case");
      continue;
    }
    if (evaluationIds.has(evaluation.id)) {
      failures.push(`Duplicate evaluation ID: ${evaluation.id}`);
    }
    evaluationIds.add(evaluation.id);

    const agent = catalogAgents.get(evaluation.agent);
    if (!agent) {
      failures.push(`Evaluation ${evaluation.id} references unknown agent ${evaluation.agent}`);
      continue;
    }
    const metadata = loadJson(`${agent.path}/agent.json`);
    for (const skillName of evaluation.expectedSkills) {
      if (!catalogSkills.has(skillName)) {
        failures.push(`Evaluation ${evaluation.id} references unknown skill ${skillName}`);
      } else if (!metadata?.skills?.includes(skillName)) {
        failures.push(`Evaluation ${evaluation.id} expects skill ${skillName} outside agent ${agent.name}`);
      }
    }
    for (const toolName of evaluation.forbiddenTools) {
      if (!contractTools.has(toolName)) {
        failures.push(`Evaluation ${evaluation.id} references unknown forbidden tool ${toolName}`);
      }
    }
    if (agent.access === "read-only" && !evaluation.forbiddenTools.includes("commit_edit_draft")) {
      failures.push(`Read-only evaluation ${evaluation.id} must forbid commit_edit_draft`);
    }
  }
}

const seedMetadata = loadJson("seeds/power-platform/seed.json");
if (!seedMetadata || typeof seedMetadata.file !== "string" || typeof seedMetadata.sha256 !== "string" || typeof seedMetadata.size !== "number") {
  failures.push("Canonical Power Platform seed metadata is invalid");
} else {
  const seedPath = join(rootPath, "seeds", "power-platform", seedMetadata.file);
  if (!existsSync(seedPath)) {
    failures.push(`Canonical Power Platform seed is missing: ${seedMetadata.file}`);
  } else {
    const seedBytes = readFileSync(seedPath);
    const seedHash = createHash("sha256").update(seedBytes).digest("hex");
    if (seedBytes.length !== seedMetadata.size) {
      failures.push(`Canonical Power Platform seed size changed: ${seedBytes.length} != ${seedMetadata.size}`);
    }
    if (seedHash !== seedMetadata.sha256) {
      failures.push(`Canonical Power Platform seed SHA-256 changed: ${seedHash}`);
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