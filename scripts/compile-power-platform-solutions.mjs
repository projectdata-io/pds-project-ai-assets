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

function skillTitle(skillName) {
  const source = readFileSync(join(rootPath, "skills", skillName, "SKILL.md"), "utf8");
  return source.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? toPascalCase(skillName);
}

function skillDescription(skillName) {
  const source = readFileSync(join(rootPath, "skills", skillName, "SKILL.md"), "utf8");
  const value = source.match(/^description:\s*(.+)$/m)?.[1]?.trim();
  if (!value) {
    throw new Error(`Skill ${skillName} has no description`);
  }
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

function addWorkflowTools(unpackedPath, agentSchema, metadata) {
  const genericToolDataPath = join(
    unpackedPath,
    "botcomponents",
    `${agentSchema}.topic.PDSProjectAI`,
    "data"
  );
  const genericToolData = readFileSync(genericToolDataPath, "utf8");
  const connectionReference = genericToolData.match(/^\s*connectionReference:\s*(.+)$/m)?.[1]?.trim();
  if (!connectionReference) {
    throw new Error(`Seed MCP tool for ${metadata.name} has no connectionReference`);
  }

  const mappingPath = join(unpackedPath, "Assets", "botcomponent_connectionreferenceset.xml");
  let mapping = readFileSync(mappingPath, "utf8");
  const mappingEntries = [];

  for (const skillName of metadata.skills) {
    const skill = catalog.skills.find((item) => item.name === skillName);
    if (!skill) {
      throw new Error(`Agent ${metadata.name} references unknown skill ${skillName}`);
    }
    const title = skillTitle(skillName);
    const description = skillDescription(skillName);
    const componentName = toPascalCase(skillName);
    const componentSchema = `${agentSchema}.topic.${componentName}`;
    const componentDirectory = join(unpackedPath, "botcomponents", componentSchema);
    mkdirSync(componentDirectory, { recursive: true });

    writeFileSync(
      join(componentDirectory, "botcomponent.xml"),
      `<botcomponent schemaname="${xmlEscape(componentSchema)}">\n` +
        `  <componenttype>9</componenttype>\n` +
        `  <description>${xmlEscape(description)}</description>\n` +
        `  <iscustomizable>1</iscustomizable>\n` +
        `  <name>${xmlEscape(title)}</name>\n` +
        `  <parentbotid>\n` +
        `    <schemaname>${xmlEscape(agentSchema)}</schemaname>\n` +
        `  </parentbotid>\n` +
        `  <statecode>0</statecode>\n` +
        `  <statuscode>1</statuscode>\n` +
        `</botcomponent>\n`,
      "utf8"
    );
    writeFileSync(
      join(componentDirectory, "data"),
      `kind: TaskDialog\n` +
        `modelDisplayName: ${JSON.stringify(title)}\n` +
        `modelDescription: ${JSON.stringify(description)}\n` +
        `action:\n` +
        `  kind: InvokeExternalAgentTaskAction\n` +
        `  connectionReference: ${connectionReference}\n` +
        `  connectionProperties:\n` +
        `    mode: Invoker\n\n` +
        `  operationDetails:\n` +
        `    kind: ModelContextProtocolMetadata\n` +
        `    operationId: InvokeServer\n`,
      "utf8"
    );
    mappingEntries.push(
      `  <botcomponent_connectionreference botcomponentid.schemaname="${xmlEscape(componentSchema)}" connectionreferenceid.connectionreferencelogicalname="${xmlEscape(connectionReference)}">\n` +
        `    <iscustomizable>1</iscustomizable>\n` +
        `  </botcomponent_connectionreference>`
    );
  }

  mapping = mapping.replace(
    "</botcomponent_connectionreferenceset>",
    `${mappingEntries.join("\n")}\n</botcomponent_connectionreferenceset>`
  );
  writeFileSync(mappingPath, mapping, "utf8");
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

  const instructions = readFileSync(instructionsPath, "utf8").trim();
  const basePascalName = toPascalCase(agent.name);
  const pascalName = `${basePascalName}Standard`;
  const schemaName = `${publisherPrefix}_${pascalName}`;
  const solutionName = `${publisherPrefix.toUpperCase()}${pascalName}`;
  const displayName = `${metadata.title} (Standard)`;
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

  addWorkflowTools(workspacePath, schemaName, metadata);

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