import {
  existsSync,
  cpSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const rootPath = fileURLToPath(new URL("../", import.meta.url));
const catalog = JSON.parse(readFileSync(join(rootPath, "catalog.json"), "utf8"));
const publisherPrefix = process.env.PDS_POWER_PLATFORM_PUBLISHER_PREFIX ?? "pds";
const solutionVersion = process.env.PDS_POWER_PLATFORM_SOLUTION_VERSION ?? "1.0.0.1";
const seedPath = join(rootPath, "seeds", "power-platform", "Agentseed_1_0_0_1.zip");
const buildRoot = join(rootPath, "build", "power-platform");
const outputRoot = join(rootPath, "dist", "solutions");
const pacCommand = process.env.PAC_CLI_PATH ?? "pac";

function toPascalCase(value) {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => `${part[0].toUpperCase()}${part.slice(1)}`)
    .join("");
}

function runCommand(command, args) {
  const result = spawnSync(command, args, {
    cwd: rootPath,
    encoding: "utf8",
    shell: false,
    stdio: ["ignore", "pipe", "pipe"]
  });
  if (result.error) {
    throw new Error(`Unable to run ${command}: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(`${command} ${args.join(" ")} failed${output ? `:\n${output}` : ""}`);
  }
  return result.stdout.trim();
}

function runPac(args) {
  return runCommand(pacCommand, args);
}

function xmlEscape(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function replaceTextFiles(directory, replacements) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      replaceTextFiles(path, replacements);
      continue;
    }
    if (/\.(?:png|jpg|jpeg|gif|ico)$/i.test(entry.name)) {
      continue;
    }
    let content = readFileSync(path, "utf8");
    for (const [from, to] of replacements) {
      content = content.replaceAll(from, to);
    }
    writeFileSync(path, content, "utf8");
  }
}

function renameSchemaPaths(directory, from, to) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const oldPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      renameSchemaPaths(oldPath, from, to);
      if (entry.name.includes(from)) {
        const newPath = join(directory, entry.name.replaceAll(from, to));
        cpSync(oldPath, newPath, { recursive: true });
        rmSync(oldPath, { recursive: true, force: true });
      }
    }
  }
}

function yamlQuote(value) {
  return JSON.stringify(value);
}

function stripQuotedScalar(value) {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseSkill(skillName) {
  const sourcePath = join(rootPath, "skills", skillName, "SKILL.md");
  const source = readFileSync(sourcePath, "utf8").replaceAll("\r\n", "\n");
  const frontmatterMatch = source.match(/^---\n([\s\S]*?)\n---\n/);
  if (!frontmatterMatch) {
    throw new Error(`skills/${skillName}/SKILL.md has no frontmatter`);
  }
  const descriptionLine = frontmatterMatch[1].match(/^description:\s*(.+)$/m)?.[1];
  if (!descriptionLine) {
    throw new Error(`skills/${skillName}/SKILL.md has no description`);
  }
  const body = source.slice(frontmatterMatch[0].length);
  const title = body.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? toPascalCase(skillName);
  const sections = new Map();
  const headings = [...body.matchAll(/^##\s+(.+)$/gm)];
  for (let index = 0; index < headings.length; index += 1) {
    const heading = headings[index];
    const start = (heading.index ?? 0) + heading[0].length;
    const end = headings[index + 1]?.index ?? body.length;
    sections.set(heading[1].trim(), body.slice(start, end).trim());
  }
  return { name: skillName, title, description: stripQuotedScalar(descriptionLine), sections };
}

function renderSkillWorkflow(skill) {
  const sectionOrder = [
    "When to use",
    "When not to use",
    "Procedure",
    "Workflow",
    "Guardrails",
    "Confirmation format",
    "Response format",
    "Output Format",
    "Failure handling",
    "Error Handling"
  ];
  const parts = [];
  for (const heading of sectionOrder) {
    if (skill.sections.has(heading)) {
      parts.push(`## ${heading}\n\n${skill.sections.get(heading)}`);
    }
  }
  if (parts.length === 0) {
    for (const [heading, content] of skill.sections) {
      parts.push(`## ${heading}\n\n${content}`);
    }
  }
  return parts.join("\n\n");
}

function skillTriggerQueries(skill) {
  const useWhen = skill.sections.get("Use When") ?? "";
  const bullets = useWhen
    .split("\n")
    .map((line) => line.replace(/^\s*-\s*/, "").trim().replace(/[.;]+\s*$/, ""))
    .filter((line) => line.length > 0 && !line.startsWith("#"));
  const queries = [];
  for (const candidate of [skill.title, ...bullets]) {
    if (candidate.length === 0 || candidate.length > 200 || queries.includes(candidate)) {
      continue;
    }
    queries.push(candidate);
    if (queries.length === 8) {
      break;
    }
  }
  return queries;
}

function renderSkillTopicData(skill, workflowMarkdown) {
  const componentName = toPascalCase(skill.name);
  const triggerQueries = skillTriggerQueries(skill).map((query) => `      - ${yamlQuote(query)}`).join("\n");
  const body = `${skill.description}\n\n${workflowMarkdown.trim()}`;
  const messageLines = body
    .split("\n")
    .map((line) => `          - ${yamlQuote(line)}`)
    .join("\n");
  return `kind: AdaptiveDialog
beginDialog:
  kind: OnRecognizedIntent
  id: main
  intent:
    displayName: ${yamlQuote(skill.title)}
    description: ${yamlQuote(skill.description)}
    includeInOnSelectIntent: true
    triggerQueries:
${triggerQueries}

  actions:
    - kind: SendActivity
      id: run${componentName}
      activity:
        text:
${messageLines}

    - kind: EndDialog
      id: end${componentName}
`;
}

function addSkillComponents(unpackedPath, agentSchema, metadata) {
  // The seed's single MCP TaskDialog already exposes the whole server; cloning it per skill
  // registers duplicate MCP servers on the agent and breaks tool discovery after import.
  const genericToolDataPath = join(
    unpackedPath,
    "botcomponents",
    `${agentSchema}.topic.PDSProjectAI`,
    "data"
  );
  const genericToolData = readFileSync(genericToolDataPath, "utf8");
  if (!/^\s*connectionReference:\s*\S+/m.test(genericToolData)) {
    throw new Error(`Seed MCP tool for ${metadata.name} has no connectionReference`);
  }

  for (const skillName of metadata.skills) {
    const skill = parseSkill(skillName);
    const componentName = toPascalCase(skillName);
    const topicSchema = `${agentSchema}.topic.${componentName}`;

    const topicDirectory = join(unpackedPath, "botcomponents", topicSchema);
    mkdirSync(topicDirectory, { recursive: true });
    writeFileSync(
      join(topicDirectory, "botcomponent.xml"),
      `<botcomponent schemaname="${xmlEscape(topicSchema)}">\n` +
        `  <componenttype>9</componenttype>\n` +
        `  <description>${xmlEscape(skill.description)}</description>\n` +
        `  <iscustomizable>1</iscustomizable>\n` +
        `  <name>${xmlEscape(skill.title)}</name>\n` +
        `  <parentbotid>\n` +
        `    <schemaname>${xmlEscape(agentSchema)}</schemaname>\n` +
        `  </parentbotid>\n` +
        `  <statecode>0</statecode>\n` +
        `  <statuscode>1</statuscode>\n` +
        `</botcomponent>\n`,
      "utf8"
    );
    writeFileSync(join(topicDirectory, "data"), renderSkillTopicData(skill, renderSkillWorkflow(skill)), "utf8");
  }
}

if (publisherPrefix !== "pds") {
  throw new Error("The canonical MCP connector seed requires PDS_POWER_PLATFORM_PUBLISHER_PREFIX=pds");
}
if (!/^\d+\.\d+\.\d+\.\d+$/.test(solutionVersion)) {
  throw new Error("PDS_POWER_PLATFORM_SOLUTION_VERSION must contain four numeric parts, for example 1.0.123.2");
}

runPac(["help"]);
if (!existsSync(seedPath)) {
  throw new Error(`Missing canonical Power Platform seed at ${seedPath}`);
}
rmSync(buildRoot, { recursive: true, force: true });
rmSync(outputRoot, { recursive: true, force: true });
mkdirSync(buildRoot, { recursive: true });
mkdirSync(outputRoot, { recursive: true });
const solutionPaths = [];
const standardAgents = catalog.agents.filter((agent) => agent.authoringTargets.includes("standard-agent"));

for (const agent of standardAgents) {
  const metadata = JSON.parse(readFileSync(join(rootPath, agent.path, "agent.json"), "utf8"));
  const instructionsPath = join(rootPath, "build", "copilot-studio", agent.name, "instructions.md");
  if (!existsSync(instructionsPath)) {
    throw new Error(`Missing generated instructions for ${agent.name}; run npm run compile first`);
  }

  const baseInstructions = readFileSync(instructionsPath, "utf8").trim();
  const workflowDocs = metadata.skills.map((skillName) => {
    const topicPath = join(rootPath, "build", "copilot-studio", agent.name, "topics", `${skillName}.md`);
    if (!existsSync(topicPath)) {
      throw new Error(`Missing generated workflow instructions for ${agent.name}/${skillName}; run npm run compile first`);
    }
    return readFileSync(topicPath, "utf8").trim();
  });
  const instructions = `${baseInstructions}\n\n## Workflow Procedures\n\n${workflowDocs.join("\n\n")}`;
  const basePascalName = toPascalCase(agent.name);
  const pascalName = `${basePascalName}Standard`;
  const schemaName = `${publisherPrefix}_${pascalName}`;
  const solutionName = `${publisherPrefix.toUpperCase()}${pascalName}`;
  const displayName = metadata.title;
  const workspacePath = join(buildRoot, agent.name);
  mkdirSync(workspacePath, { recursive: true });
  runCommand("tar", ["-xf", seedPath, "-C", workspacePath]);

  replaceTextFiles(workspacePath, [
    ["pds_Agentseed", schemaName],
    ["Agent seed", displayName]
  ]);
  renameSchemaPaths(workspacePath, "pds_Agentseed", schemaName);

  const gptDataPath = join(workspacePath, "botcomponents", `${schemaName}.gpt.default`, "data");
  const gptData = readFileSync(gptDataPath, "utf8");
  writeFileSync(
    gptDataPath,
    gptData.replace(/instructions:\s*[^\r\n]*/, `instructions: |-\n${instructions
      .split("\n")
      .map((line) => `  ${line}`)
      .join("\n")}`),
    "utf8"
  );

  addSkillComponents(workspacePath, schemaName, metadata);

  const solutionXmlPath = join(workspacePath, "solution.xml");
  let solutionXml = readFileSync(solutionXmlPath, "utf8");
  solutionXml = solutionXml
    .replace(/<UniqueName>[^<]+<\/UniqueName>/, `<UniqueName>${solutionName}</UniqueName>`)
    .replace(/<Version>[^<]+<\/Version>/, `<Version>${solutionVersion}</Version>`)
    .replace(/<LocalizedName description="[^"]*" languagecode="1033"\s*\/>/, `<LocalizedName description="${xmlEscape(displayName)}" languagecode="1033" />`);
  writeFileSync(solutionXmlPath, solutionXml, "utf8");

  const solutionPath = join(outputRoot, `${solutionName}.zip`);
  runCommand("powershell", [
    "-NoProfile",
    "-File",
    join(rootPath, "scripts", "pack-directory.ps1"),
    "-SourceDirectory",
    workspacePath,
    "-DestinationZip",
    solutionPath
  ]);
  runPac([
    "solution",
    "unpack",
    "--zipfile",
    solutionPath,
    "--folder",
    join(buildRoot, "validated-solutions", agent.name),
    "--packagetype",
    "Unmanaged"
  ]);
  solutionPaths.push(solutionPath);
}

for (const solutionPath of solutionPaths) {
  if (!existsSync(solutionPath) || statSync(solutionPath).size === 0) {
    throw new Error(`PAC did not produce a nonempty solution ZIP at ${solutionPath}`);
  }
}

console.log(`Generated ${standardAgents.length} Standard Agent workspaces in ${buildRoot}`);
console.log(`Packed ${solutionPaths.length} unmanaged solution ZIP files at version ${solutionVersion} in ${outputRoot}`);