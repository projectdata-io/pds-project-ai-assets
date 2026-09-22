import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const rootPath = fileURLToPath(new URL("../", import.meta.url));
const catalog = JSON.parse(readFileSync(join(rootPath, "catalog.json"), "utf8"));
const outputRoot = join(rootPath, "build", "agent-templates");
const agents = catalog.agents.filter((agent) => agent.authoringTargets.includes("agent"));
const failures = [];

if (!existsSync(outputRoot)) {
  failures.push("Agent template output directory is missing");
} else {
  const actualFiles = readdirSync(outputRoot).filter((name) => name.endsWith(".yaml")).sort();
  const expectedFiles = agents.map((agent) => `${agent.name}.yaml`).sort();
  if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) {
    failures.push(`Agent template files do not match catalog targets: ${actualFiles.join(", ")}`);
  }
}

for (const agent of agents) {
  const metadata = JSON.parse(readFileSync(join(rootPath, agent.path, "agent.json"), "utf8"));
  const templatePath = join(outputRoot, `${agent.name}.yaml`);
  if (!existsSync(templatePath)) {
    failures.push(`Missing Agent template for ${agent.name}`);
    continue;
  }

  const content = readFileSync(templatePath, "utf8");
  const mcpTools = (content.match(/^\s+kind: McpTool$/gm) ?? []).length;
  const inlineSkills = (content.match(/^\s+kind: InlineAgentSkill$/gm) ?? []).length;
  if (mcpTools !== 1) {
    failures.push(`${agent.name} has ${mcpTools} McpTool components; expected 1`);
  }
  if (inlineSkills !== metadata.skills.length) {
    failures.push(`${agent.name} has ${inlineSkills} InlineAgentSkill components; expected ${metadata.skills.length}`);
  }
  if (!content.includes("authoringModel: CliCopilot")) {
    failures.push(`${agent.name} is not a CliCopilot Agent template`);
  }
  if (!content.includes("operationId: InvokeServer")) {
    failures.push(`${agent.name} has no InvokeServer MCP operation`);
  }
  if (!content.includes("__PDS_CONNECTION_ID__") || !content.includes("__PDS_CUSTOM_CONNECTOR_ID__")) {
    failures.push(`${agent.name} is missing deployment placeholders`);
  }
  for (const skillName of metadata.skills) {
    if (!content.includes(`skillFolderName: ${skillName}`)) {
      failures.push(`${agent.name} is missing inline skill ${skillName}`);
    }
  }
  for (const forbidden of ["auditInfo:", "synchronizationStatus:", "createdBy:", "modifiedBy:", "applicationId:"]) {
    if (content.includes(forbidden)) {
      failures.push(`${agent.name} contains environment-specific field ${forbidden}`);
    }
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Verified ${agents.length} Agent templates.`);
}
