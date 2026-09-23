import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const rootPath = fileURLToPath(new URL("../", import.meta.url));
const catalog = JSON.parse(readFileSync(join(rootPath, "catalog.json"), "utf8"));
const outputRoot = join(rootPath, "dist", "agent-packages");
const packScript = join(rootPath, "scripts", "pack-directory.ps1");
const bundleRoot = join(rootPath, "build", "copilot-studio");
const templateRoot = join(rootPath, "build", "agent-templates");

function toPascalCase(value) {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => `${part[0].toUpperCase()}${part.slice(1)}`)
    .join("");
}

function readUtf8(path) {
  return readFileSync(path, "utf8").replaceAll("\r\n", "\n");
}

function formatList(values) {
  return values.length > 0 ? values.map((value) => `\`${value}\``).join(", ") : "none";
}

function renderEvaluationCase(evaluation) {
  return `### \`${evaluation.id}\`

> ${evaluation.prompt}

- Expected workflows: ${formatList(evaluation.expectedSkills)}
- Forbidden tools: ${formatList(evaluation.forbiddenTools)}`;
}

function renderManualSetup(agent, metadata, manifest, hasTemplate, evaluationCases) {
  const skills = metadata.skills.map((skill) => `- \`${skill}\``).join("\n");
  const isCommit = metadata.access === "commit";
  const casesText = evaluationCases.length > 0 ? evaluationCases.map(renderEvaluationCase).join("\n\n") : "No evaluation cases are defined for this agent yet.";

  const templateSection = hasTemplate
    ? `
## Option A — Deploy with the BotDefinition template (recommended)

\`agent.yaml\` is a complete Copilot Studio \`BotDefinition\` with the agent instructions, the PDS Project AI MCP tool binding, and one native \`InlineAgentSkill\` per mapped skill already embedded. Deploy it to a designated **non-production** environment with the Power Platform CLI:

\`\`\`powershell
$env:PDS_POWER_PLATFORM_ENVIRONMENT = 'https://your-dev-environment.crm.dynamics.com'
$env:PDS_POWER_PLATFORM_AGENT_SOLUTION = 'PDSGeneratedAgents'
$env:PDS_AGENT_CONNECTION_ID = '<target-environment-connection-id>'
$env:PDS_AGENT_CUSTOM_CONNECTOR_ID = '<target-environment-custom-connector-id>'

npm run deploy:agents -- --confirm --agent ${agent.name}
\`\`\`

The helper substitutes the connection placeholders in \`agent.yaml\` and calls \`pac copilot create\`. This command mutates the target environment and refuses to run without \`--confirm\`. After creation, open the agent in Copilot Studio, bind the connection, and test before publishing.

## Option B — Create the agent manually
`
    : `
## Create the agent manually
`;

  return `# ${metadata.title} — Copilot Studio Setup

This package contains the portable assets for **${metadata.title}**.

## Package contents

- \`manifest.json\` — agent metadata, access level, MCP tool allowlist, and skill inventory.
- \`instructions.md\` — the complete agent instructions.
- \`skills/<name>/SKILL.md\` — the full workflow specification for every mapped skill.${hasTemplate ? "\n- `agent.yaml` — the Copilot Studio `BotDefinition` template (inline skills + MCP tool)." : ""}
- \`README.md\` — this guide.
${templateSection}
1. Open Microsoft Copilot Studio and go to **Agents**.
2. Select **New agent** → **Blank agent**.
3. Set **Name** to \`${metadata.title}\`.
4. Set **Description** to: ${metadata.description}
5. Enable **generative orchestration** (the default for new agents).
6. Open the agent **Overview** page → **Instructions**.
7. Paste the entire contents of \`instructions.md\`.
8. Save the agent.

## Add the PDS Project AI MCP tool

1. In the agent, open **Tools**.
2. Select **Add a tool** → **New tool** → **Model Context Protocol**.
3. Configure the deployed PDS Project AI MCP endpoint and its connection.
4. Use **end-user authentication** so API authorization stays scoped to the signed-in user.
5. Save the tool and confirm its operations appear on the tool details page.

### Permission boundary

| Access | OAuth scope |
| --- | --- |
| ${isCommit ? "This agent (commit)" : "This agent (read-only)"} | \`${isCommit ? "Session.ReadWrite" : "Session.ReadOnly"}\` |

Grant only the scope in the table. OAuth scope is the real security boundary — agent instructions are behavioral guidance only.${isCommit ? "\n\nSet **Ask the end user before running** for `commit_edit_draft`." : ""}

## Load the skills

The \`skills/\` folder contains the workflow each agent performs. Copilot Studio does not import \`SKILL.md\` as native components on manually created agents. Use each skill file as the authoring specification:

1. Open \`skills/<name>/SKILL.md\`.
2. For deterministic multi-step workflows, create a **Topic** and copy the skill's *When to use*, *Procedure*, *Guardrails*, *Response format*, and *Failure handling* into it. In instructions, type \`/\` to reference the configured MCP tool explicitly.
3. For focused single-turn analyses, create a **Prompt tool** with the skill's instructions.
4. Keep the skill name so evaluation cases stay traceable.

The embedded \`instructions.md\` already contains a routing catalog of these workflows, so a minimal setup can rely on the instructions plus the MCP tool alone; topics/prompts add deterministic triggers.

## Mapped skills in this package

${skills}

## Test before publishing

Use the Copilot Studio test pane with the evaluation cases below.

${casesText}

For every case verify:

1. The expected workflow is selected.
2. Required MCP inputs are collected rather than invented.
3. Forbidden write tools are not called.
4. Results include stable entity identifiers and data limitations.
5. Sessions created by the workflow are closed when no longer needed.${isCommit ? "\n6. The agent does not commit before explicit user confirmation." : ""}

Publish the agent only after its evaluation cases pass.
`;
}

function packDirectory(sourceDirectory, destinationZip) {
  const result = spawnSync(
    "powershell",
    ["-NoProfile", "-File", packScript, "-SourceDirectory", sourceDirectory, "-DestinationZip", destinationZip],
    { cwd: rootPath, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
  );
  if (result.error) {
    throw new Error(`Unable to run pack-directory.ps1: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(`pack-directory.ps1 failed for ${destinationZip}${output ? `:\n${output}` : ""}`);
  }
}

if (!existsSync(bundleRoot)) {
  throw new Error("Missing build/copilot-studio; run npm run compile first");
}

rmSync(outputRoot, { recursive: true, force: true });
mkdirSync(outputRoot, { recursive: true });

const stagingRoot = join(rootPath, "build", "agent-packages");
rmSync(stagingRoot, { recursive: true, force: true });
mkdirSync(stagingRoot, { recursive: true });

const evaluations = JSON.parse(readUtf8(join(rootPath, "examples", "evaluations.json")));

const packaged = [];
for (const agent of catalog.agents) {
  const metadata = JSON.parse(readUtf8(join(rootPath, agent.path, "agent.json")));
  const manifestPath = join(bundleRoot, agent.name, "manifest.json");
  const instructionsPath = join(bundleRoot, agent.name, "instructions.md");
  if (!existsSync(manifestPath) || !existsSync(instructionsPath)) {
    throw new Error(`Missing compiled bundle for ${agent.name}; run npm run compile first`);
  }
  const manifest = JSON.parse(readUtf8(manifestPath));
  const instructions = readUtf8(instructionsPath);

  const hasTemplate = agent.authoringTargets.includes("agent");
  const templatePath = join(templateRoot, `${agent.name}.yaml`);
  if (hasTemplate && !existsSync(templatePath)) {
    throw new Error(`Missing Agent template for ${agent.name}; run npm run compile:agents first`);
  }

  const stage = join(stagingRoot, agent.name);
  mkdirSync(stage, { recursive: true });
  writeFileSync(join(stage, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  writeFileSync(join(stage, "instructions.md"), instructions, "utf8");
  if (hasTemplate) {
    writeFileSync(join(stage, "agent.yaml"), readUtf8(templatePath), "utf8");
  }

  for (const skillName of metadata.skills) {
    const skillSource = join(rootPath, "skills", skillName, "SKILL.md");
    if (!existsSync(skillSource)) {
      throw new Error(`Agent ${agent.name} references missing skill ${skillName}`);
    }
    const skillDir = join(stage, "skills", skillName);
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, "SKILL.md"), readUtf8(skillSource), "utf8");
  }

  const evaluationCases = evaluations.cases.filter((evaluation) => evaluation.agent === agent.name);

  writeFileSync(join(stage, "README.md"), renderManualSetup(agent, metadata, manifest, hasTemplate, evaluationCases), "utf8");

  const zipName = `PDS${toPascalCase(agent.name)}.zip`;
  const zipPath = join(outputRoot, zipName);
  packDirectory(stage, zipPath);
  packaged.push(zipPath);
}

const checksums = packaged
  .map((path) => {
    const hash = createHash("sha256").update(readFileSync(path)).digest("hex");
    return `${hash}  ${relative(outputRoot, path).replaceAll("\\", "/")}`;
  })
  .join("\n");
writeFileSync(join(outputRoot, "SHA256SUMS.txt"), `${checksums}\n`, "utf8");

console.log(`Packaged ${packaged.length} agent ZIP files in ${outputRoot}.`);
