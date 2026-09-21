import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const rootPath = fileURLToPath(new URL("../", import.meta.url));
const catalog = JSON.parse(readFileSync(join(rootPath, "catalog.json"), "utf8"));
const publisherPrefix = process.env.PDS_POWER_PLATFORM_PUBLISHER_PREFIX ?? "pds";
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

function runPac(args) {
  const result = spawnSync(pacCommand, args, {
    cwd: rootPath,
    encoding: "utf8",
    shell: false,
    stdio: ["ignore", "pipe", "pipe"]
  });
  if (result.error) {
    throw new Error(`Unable to run ${pacCommand}: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(`pac ${args.join(" ")} failed${output ? `:\n${output}` : ""}`);
  }
  return result.stdout.trim();
}

if (!/^[A-Za-z][A-Za-z0-9]{1,7}$/.test(publisherPrefix) || publisherPrefix.toLowerCase().startsWith("mscrm")) {
  throw new Error("PDS_POWER_PLATFORM_PUBLISHER_PREFIX must be 2-8 alphanumeric characters, start with a letter, and not start with mscrm");
}

runPac(["help"]);
rmSync(buildRoot, { recursive: true, force: true });
rmSync(outputRoot, { recursive: true, force: true });
mkdirSync(buildRoot, { recursive: true });
mkdirSync(outputRoot, { recursive: true });
const solutionPaths = [];

for (const agent of catalog.agents) {
  const metadata = JSON.parse(readFileSync(join(rootPath, agent.path, "agent.json"), "utf8"));
  const instructionsPath = join(rootPath, "build", "copilot-studio", agent.name, "instructions.md");
  if (!existsSync(instructionsPath)) {
    throw new Error(`Missing generated instructions for ${agent.name}; run npm run compile first`);
  }

  const instructions = readFileSync(instructionsPath, "utf8").trim();
  const pascalName = toPascalCase(agent.name);
  const schemaName = `${publisherPrefix}_${pascalName}`;
  const solutionName = `${publisherPrefix.toUpperCase()}${pascalName}`;
  const workspacePath = join(buildRoot, agent.name);

  runPac([
    "copilot",
    "init",
    "--name",
    metadata.title,
    "--publisher-prefix",
    publisherPrefix,
    "--schema-name",
    schemaName,
    "--authoring-mode",
    "cli-copilot",
    "--project-dir",
    workspacePath,
    "--instructions",
    "Generated instructions placeholder."
  ]);

  const settingsPath = join(workspacePath, "settings.mcs.yml");
  const settings = readFileSync(settingsPath, "utf8").replaceAll("\r\n", "\n");
  const placeholder = '          value: "Generated instructions placeholder."';
  if (!settings.includes(placeholder)) {
    throw new Error(`PAC workspace for ${agent.name} did not contain the expected instructions placeholder`);
  }
  const instructionBlock = `          value: |-\n${instructions
    .split("\n")
    .map((line) => `            ${line}`)
    .join("\n")}`;
  writeFileSync(settingsPath, settings.replace(placeholder, instructionBlock), "utf8");

  runPac([
    "copilot",
    "pack",
    "--publisher-prefix",
    publisherPrefix,
    "--project-dir",
    workspacePath,
    "--solution-name",
    solutionName,
    "--output-path",
    outputRoot
  ]);
  solutionPaths.push(join(outputRoot, `${solutionName}.zip`));
}

for (const solutionPath of solutionPaths) {
  if (!existsSync(solutionPath) || statSync(solutionPath).size === 0) {
    throw new Error(`PAC did not produce a nonempty solution ZIP at ${solutionPath}`);
  }
}

console.log(`Generated ${catalog.agents.length} CLI-authored workspaces in ${buildRoot}`);
console.log(`Packed ${solutionPaths.length} unmanaged solution ZIP files in ${outputRoot}`);