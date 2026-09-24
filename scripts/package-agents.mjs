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

const sharePointSetup = {
  "portfolio-list-maintainer": `### Minimal configuration

Create one **Portfolio list** with **Contribute** access for the Work IQ SharePoint connection.

| Column | Type | Required |
| --- | --- | --- |
| Project file reference | Single line of text | Yes; unique when supported |
| Project file name | Single line of text | No |
| Project file link | Hyperlink | No |
| Project title | Single line of text | No |
| Start date, Finish date, Status date | Date and Time | No |
| Overall % complete | Number | No |
| Next milestone | Single line of text | No |
| Next milestone date | Date and Time | No |

### Recommended configuration

Add indexed Project file reference and preserve any manually maintained columns. The agent updates only mapped evidence-backed fields and leaves unrelated columns unchanged.`,
  "task-list-synchronizer": `### Minimal configuration

Create one **Task list** with **Contribute** access for the Work IQ SharePoint connection.

| Column | Type | Required |
| --- | --- | --- |
| Project file reference | Single line of text | Yes |
| Task UID | Number | Yes |
| Project title, Task name, WBS | Single line of text | No |
| Start date, Finish date, Deadline | Date and Time | No |
| Duration | Single line of text | No |
| % complete | Number | No |
| Milestone flag | Yes/No | No |
| Predecessors, Assigned resources | Multiple lines of text | No |
| Constraint | Single line of text | No |

The match key is the composite Project file reference + Task UID; index both columns. The agent creates, updates, and deletes rows only for the triggering file.

### Recommended configuration

Add views filtered by project file reference and preserve manually maintained columns. Do not rely on a SharePoint composite uniqueness constraint; the agent enforces the composite key during reconciliation.`,
  "project-intake-triage": `### Minimal configuration

Create one **Intake list** with **Contribute** access for the Work IQ SharePoint connection.

| Column | Type | Required |
| --- | --- | --- |
| Project file reference | Single line of text | Yes; unique when supported |
| Project file name, Project title | Single line of text | No |
| Start date, Finish date, Triage date | Date and Time | No |
| Task count, Milestone count, Resource count, Assignment count | Number | No |
| Triage classification | Choice: attention, oversized, incomplete, standard | No |

### Recommended configuration

Index Project file reference, add a view grouped by Triage classification, and keep the configured oversized threshold documented with the list configuration.`,
  "change-watcher": `### Minimal configuration

Create or reuse two resources:

| List | Access | Key/configuration |
| --- | --- | --- |
| Task list snapshot | Read | Same project file reference + Task UID rows maintained by Task List Synchronizer |
| Change-report list | Contribute, append-only | No unique key required |

For the **Change-report list**, add: Project file reference (Single line of text), Project title (Single line of text), Change date (Date and Time), Change kind (Choice: initial, changed, unchanged), Added count (Number), Removed count (Number), Changed count (Number), and Change summary (Multiple lines of text).

### Recommended configuration

Index the snapshot key columns, make the change-report list append-only for this connection, and add a Power Automate flow or SharePoint alert for Change kind = changed.`,
  "stakeholder-notifier": `### Minimal configuration

Create one **Notification list** with **Contribute** access for the Work IQ SharePoint connection.

| Column | Type | Required |
| --- | --- | --- |
| Project file reference | Single line of text | Yes |
| Project title, Audience | Single line of text | No |
| Notification date | Date and Time | Yes |
| Notification body | Multiple lines of text | No |
| Item count | Number | No |

The match key is Project file reference + Audience + Notification date; index all three columns.

### Recommended configuration

Add a Power Automate flow that delivers entries to the configured audience. This agent records entries only; it does not send email or Teams messages.`,
  "compliance-gate": `### Minimal configuration

Create one **Gate-results list** with **Contribute** access for the Work IQ SharePoint connection.

| Column | Type | Required |
| --- | --- | --- |
| Project file reference | Single line of text | Yes; unique when supported |
| Project title | Single line of text | No |
| Verdict | Choice: passed, attention, failed | Yes |
| Evaluation date | Date and Time | Yes |
| Failed gates | Multiple lines of text | No |
| Evidence summary | Multiple lines of text | No |

### Recommended configuration

Index Project file reference, retain prior evaluation history in a separate audit list or view, and alert on Verdict != passed.`,
  "project-template-provisioner": `### Minimal configuration

Configure these SharePoint resources for the Work IQ connection:

| Resource | Access | Purpose |
| --- | --- | --- |
| Template library | Read | Approved MPP templates only |
| Target library | Contribute | Destination for copied project files |
| Projects list | Contribute | Registration row; Project file reference is required and unique when supported |

### Recommended configuration

Add two read-only libraries when document-informed customization is needed:

| Resource | Access | Purpose |
| --- | --- | --- |
| Project-documentation library | Read | Referenced project charters and meeting minutes |
| Company-documents library | Read | Methodology recommendations and standards |

For the **Projects list**, add Project file reference (Single line of text), Project file name (Single line of text), Project file link (Hyperlink), Project title (Single line of text), Start date and Finish date (Date and Time), Template used (Single line of text), Provisioning date (Date and Time), Charter/meeting-minutes reference (Single line of text), and Company standards reference (Single line of text). The agent never writes to the reference libraries.`,
  "progress-collector": `### Minimal configuration

Create two lists with **Contribute** access for the Work IQ SharePoint connection:

| List | Purpose | Key/configuration |
| --- | --- | --- |
| Progress intake list | Pending requests and team submissions | Project file reference + Task UID + Assignee |
| Progress outcome list | Append-only processing results | No unique key required |

For the intake list, add Project file reference (Single line of text), Task UID (Number), Assignee (Single line of text or Person), Percent complete (Number), Remaining duration (Single line of text), Actual finish (Date and Time), Notes (Multiple lines of text), and Status (Choice: pending, applied, rejected, skipped).

### Recommended configuration

Index the composite intake key, make assignee and status visible in team views, and make the outcome list append-only. Do not allow users to delete intake rows; status transitions preserve the audit trail.`,
  "cross-project-dependency-checker": `### Minimal configuration

Create two lists with **Contribute** access for the Work IQ SharePoint connection:

| List | Purpose | Key/configuration |
| --- | --- | --- |
| Dependency register | Per-plan provides and requires declarations | Plan file reference + Declaration kind + Task/milestone UID |
| Dependency outcome list | Check results | Append-only; no unique key required |

For the register, add Plan file reference (Single line of text), Plan title (Single line of text), Declaration kind (Choice: provides, requires), Task/milestone UID (Number), Name (Single line of text), Date (Date and Time), Referenced provider milestone (Single line of text), and Declaration updated (Date and Time).

### Recommended configuration

Index all register key columns, keep declaration rows scoped to one source file, and add a flow or alert for outcome rows with broken or at-risk status.`,
  "deliverable-link-checker": `### Minimal configuration

Create two lists with **Contribute** access for the Work IQ SharePoint connection:

| List | Purpose | Key/configuration |
| --- | --- | --- |
| Deliverable register | Per-plan soft-link declarations | Plan file reference + Declaration kind + Deliverable key |
| Deliverable outcome list | Status and change results | Append-only; no unique key required |

For the register, add Plan file reference (Single line of text), Plan title (Single line of text), Declaration kind (Choice: deliverable-provides, deliverable-requires), Task UID (Number), Task name (Single line of text), Deliverable key (Single line of text), Task date (Date and Time), Declaration updated (Date and Time), Previous classification (Choice: satisfied, unsatisfied, at-risk), and Changed since last check (Yes/No).

### Recommended configuration

Use the same custom-field alias for the deliverable key across every plan, index all register key columns, and configure a Power Automate flow or SharePoint alert on the **outcome list** for changed, broken, or at-risk results. This agent records change evidence; it does not notify project managers directly.`
};

function renderSharePointSetup(agentName) {
  const setup = sharePointSetup[agentName];
  return setup ? `\n## SharePoint Setup\n\n${setup}\n` : "";
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
pac copilot create \`
  --displayName "${metadata.title} (Agent)" \`
  --schemaName "pds_${toPascalCase(agent.name)}Agent" \`
  --solution "PDSGeneratedAgents" \`
  --templateFileName "agent.yaml" \`
  --environment "https://your-dev-environment.crm.dynamics.com"
\`\`\`

This command mutates the target environment. The template's connection placeholders (\`__PDS_CONNECTION_ID__\`, \`__PDS_CUSTOM_CONNECTOR_ID__\`) can be left as-is: after creation, open the agent in Copilot Studio and bind the MCP tool to a connection in the target environment. If you prefer the binding to be correct from the start, replace the placeholders in \`agent.yaml\` with the target environment's connection ID and custom connector ID before deploying. Test before publishing either way.

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

${renderSharePointSetup(agent.name)}
## Add the PDS Project AI MCP tool

1. In the agent, open **Tools**.
2. Select **Add a tool** → **New tool** → **Model Context Protocol**.
3. Configure the deployed PDS Project AI MCP endpoint and its connection.
4. Use **end-user authentication** so API authorization stays scoped to the signed-in user.
5. Save the tool and confirm its operations appear on the tool details page.
${isCommit ? "\nSet **Ask the end user before running** for `commit_edit_draft`." : ""}

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
    process.platform === "win32" ? "powershell" : "pwsh",
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
