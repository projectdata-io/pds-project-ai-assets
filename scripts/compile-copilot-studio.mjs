import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const rootPath = fileURLToPath(new URL("../", import.meta.url));
const outputRoot = join(rootPath, "build", "copilot-studio");
const checkOnly = process.argv.includes("--check");

function readJson(repositoryPath) {
  return JSON.parse(readFileSync(join(rootPath, repositoryPath), "utf8"));
}

function stripQuotedScalar(value) {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseSkill(skillName) {
  const sourcePath = `skills/${skillName}/SKILL.md`;
  const source = readFileSync(join(rootPath, sourcePath), "utf8").replaceAll("\r\n", "\n");
  const frontmatterMatch = source.match(/^---\n([\s\S]*?)\n---\n/);
  if (!frontmatterMatch) {
    throw new Error(`${sourcePath} has no frontmatter`);
  }

  const descriptionLine = frontmatterMatch[1].match(/^description:\s*(.+)$/m)?.[1];
  if (!descriptionLine) {
    throw new Error(`${sourcePath} has no description`);
  }

  const body = source.slice(frontmatterMatch[0].length);
  const title = body.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? skillName;
  const sections = new Map();
  const headings = [...body.matchAll(/^##\s+(.+)$/gm)];
  for (let index = 0; index < headings.length; index += 1) {
    const heading = headings[index];
    const start = (heading.index ?? 0) + heading[0].length;
    const end = headings[index + 1]?.index ?? body.length;
    sections.set(heading[1].trim(), body.slice(start, end).trim());
  }

  return {
    name: skillName,
    title,
    description: stripQuotedScalar(descriptionLine),
    sourcePath,
    sections
  };
}

function renderTopic(skill) {
  const sectionMappings = [
    ["Use When", "When to use"],
    ["Do Not Use When", "When not to use"],
    ["Workflow", "Procedure"],
    ["Guardrails", "Guardrails"],
    ["Confirmation Format", "Confirmation format"],
    ["Output Format", "Response format"],
    ["Error Handling", "Failure handling"]
  ];
  const sections = sectionMappings
    .filter(([sourceHeading]) => skill.sections.has(sourceHeading))
    .map(([sourceHeading, outputHeading]) => `## ${outputHeading}\n\n${skill.sections.get(sourceHeading)}`)
    .join("\n\n");

  return `# ${skill.title}

${skill.description}

${sections}
`;
}

function renderAgentInstructions(baseInstructions, skills) {
  const routes = skills
    .map((skill) => `- **${skill.title}** (\`${skill.name}\`): ${skill.description}`)
    .join("\n");

  return `${baseInstructions.trim()}

## Available Workflows

Select the narrowest matching workflow. The generated topic files contain the detailed procedure and safety rules for each workflow.

${routes}
`;
}

function collectFiles(directory) {
  if (!existsSync(directory)) {
    return [];
  }
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(path));
    } else {
      files.push(path);
    }
  }
  return files;
}

const catalog = readJson("catalog.json");
const catalogSkills = new Map(catalog.skills.map((skill) => [skill.name, skill]));
const expectedFiles = new Map();
const importGuide = readFileSync(join(rootPath, "agents", "copilot-studio", "README.md"), "utf8").replaceAll("\r\n", "\n");
expectedFiles.set(
  join("build", "copilot-studio", "README.md"),
  `${importGuide.trim()}\n`
);

for (const agent of catalog.agents) {
  const metadata = readJson(`${agent.path}/agent.json`);
  const baseInstructions = readFileSync(join(rootPath, agent.path, "instructions.md"), "utf8").replaceAll("\r\n", "\n");
  const skills = metadata.skills.map((skillName) => parseSkill(skillName));
  const agentOutput = join("build", "copilot-studio", agent.name);
  const tools = [...new Set(metadata.skills.flatMap((skillName) => catalogSkills.get(skillName)?.tools ?? []))].sort();
  const manifest = {
    schemaVersion: "1.0",
    generated: true,
    name: metadata.name,
    title: metadata.title,
    description: metadata.description,
    access: metadata.access,
    instructions: "instructions.md",
    tools,
    topics: skills.map((skill) => ({
      name: skill.name,
      file: `topics/${skill.name}.md`,
      source: skill.sourcePath
    }))
  };

  expectedFiles.set(join(agentOutput, "instructions.md"), renderAgentInstructions(baseInstructions, skills));
  expectedFiles.set(join(agentOutput, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  for (const skill of skills) {
    expectedFiles.set(join(agentOutput, "topics", `${skill.name}.md`), renderTopic(skill));
  }
}

if (checkOnly) {
  const actualFiles = collectFiles(outputRoot).map((file) => relative(rootPath, file));
  const unexpectedFiles = actualFiles.filter((file) => !expectedFiles.has(file));
  const staleFiles = [];
  for (const [repositoryPath, expected] of expectedFiles) {
    const path = join(rootPath, repositoryPath);
    if (!existsSync(path) || readFileSync(path, "utf8").replaceAll("\r\n", "\n") !== expected) {
      staleFiles.push(repositoryPath.replaceAll("\\", "/"));
    }
  }

  if (unexpectedFiles.length > 0 || staleFiles.length > 0) {
    for (const file of staleFiles) {
      console.error(`Missing or stale generated file: ${file}`);
    }
    for (const file of unexpectedFiles) {
      console.error(`Unexpected generated file: ${file.replaceAll("\\", "/")}`);
    }
    process.exitCode = 1;
  } else {
    console.log(`Compiled Copilot Studio bundles are current (${catalog.agents.length} agents).`);
  }
} else {
  rmSync(outputRoot, { recursive: true, force: true });
  for (const [repositoryPath, content] of expectedFiles) {
    const path = join(rootPath, repositoryPath);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content, "utf8");
  }
  console.log(`Compiled Copilot Studio bundles for ${catalog.agents.length} agents.`);
}