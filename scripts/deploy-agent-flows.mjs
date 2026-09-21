import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const rootPath = fileURLToPath(new URL("../", import.meta.url));
const catalog = JSON.parse(readFileSync(join(rootPath, "catalog.json"), "utf8"));
const args = process.argv.slice(2);
const confirmed = args.includes("--confirm");
const selectedAgent = args.includes("--agent") ? args[args.indexOf("--agent") + 1] : undefined;
const environment = process.env.PDS_POWER_PLATFORM_ENVIRONMENT;
const solution = process.env.PDS_POWER_PLATFORM_AGENT_FLOW_SOLUTION;
const connectionId = process.env.PDS_AGENT_FLOW_CONNECTION_ID;
const customConnectorId = process.env.PDS_AGENT_FLOW_CUSTOM_CONNECTOR_ID;
const pacCommand = process.env.PAC_CLI_PATH ?? "pac";
const templateRoot = join(rootPath, "build", "agent-flow-templates");
const deployRoot = join(rootPath, "build", "agent-flow-deploy");

function runPac(commandArgs) {
  const result = spawnSync(pacCommand, commandArgs, {
    cwd: rootPath,
    encoding: "utf8",
    shell: false,
    stdio: "inherit"
  });
  if (result.error) {
    throw new Error(`Unable to run ${pacCommand}: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`pac ${commandArgs.join(" ")} failed with exit code ${result.status}`);
  }
}

if (!confirmed) {
  throw new Error("Agent flow deployment mutates a Power Platform environment; pass --confirm to proceed");
}
for (const [name, value] of Object.entries({
  PDS_POWER_PLATFORM_ENVIRONMENT: environment,
  PDS_POWER_PLATFORM_AGENT_FLOW_SOLUTION: solution,
  PDS_AGENT_FLOW_CONNECTION_ID: connectionId,
  PDS_AGENT_FLOW_CUSTOM_CONNECTOR_ID: customConnectorId
})) {
  if (!value) {
    throw new Error(`${name} is required`);
  }
}

let agents = catalog.agents.filter((agent) => agent.authoringTargets.includes("agent-flow"));
if (selectedAgent) {
  agents = agents.filter((agent) => agent.name === selectedAgent);
  if (agents.length !== 1) {
    throw new Error(`Unknown or non-Agent-flow catalog agent: ${selectedAgent}`);
  }
}

rmSync(deployRoot, { recursive: true, force: true });
mkdirSync(deployRoot, { recursive: true });
for (const agent of agents) {
  const metadata = JSON.parse(readFileSync(join(rootPath, agent.path, "agent.json"), "utf8"));
  const sourcePath = join(templateRoot, `${agent.name}.yaml`);
  if (!existsSync(sourcePath)) {
    throw new Error(`Missing template ${sourcePath}; run npm run compile:agent-flows first`);
  }
  const materialized = readFileSync(sourcePath, "utf8")
    .replaceAll("__PDS_CONNECTION_ID__", connectionId)
    .replaceAll("__PDS_CUSTOM_CONNECTOR_ID__", customConnectorId);
  if (materialized.includes("__PDS_")) {
    throw new Error(`Unresolved deployment placeholder for ${agent.name}`);
  }
  const deployPath = join(deployRoot, `${agent.name}.yaml`);
  writeFileSync(deployPath, materialized, "utf8");
  const schemaName = `pds_${agent.name.split("-").map((part) => `${part[0].toUpperCase()}${part.slice(1)}`).join("")}AgentFlow`;
  runPac([
    "copilot",
    "create",
    "--displayName",
    `${metadata.title} (Agent flow)`,
    "--schemaName",
    schemaName,
    "--solution",
    solution,
    "--templateFileName",
    deployPath,
    "--environment",
    environment
  ]);
}

console.log(`Created ${agents.length} Agent flow agents in ${environment}.`);
