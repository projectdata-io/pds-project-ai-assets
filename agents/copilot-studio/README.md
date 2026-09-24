# Apply Generated Assets in Copilot Studio

The repository builds one **agent package** per catalog agent: a ZIP containing the agent's `instructions.md`, `manifest.json`, every mapped `SKILL.md`, a manual setup guide, and — for agents targeting the **Agent** product — a `BotDefinition` YAML template (`agent.yaml`) with native inline skills and the MCP tool binding.

You create the agent and add the MCP tool manually, or deploy the BotDefinition template with `pac copilot create`. The repository `SKILL.md` files remain source specifications; Copilot Studio does not import them as native components on manually created agents.

## Prerequisites

- Access to Microsoft Copilot Studio and permission to create agents and connections.
- A deployed PDS Project AI MCP endpoint.
- An OAuth connection authorized for `Session.ReadOnly` or `Session.ReadWrite`, according to the selected agent.
- Compiled bundles produced with `npm run compile` under ignored `build/copilot-studio/`.
- Power Platform CLI 2.12.1 or newer on `PATH`, or `PAC_CLI_PATH` set to the CLI executable, only when deploying Agent templates.

## SharePoint List and Library Setup for Trigger Agents

Every agent that also uses the Work IQ SharePoint MCP connector (Portfolio List Maintainer, Task List Synchronizer, Project Intake Triage, Change Watcher, Stakeholder Notifier, Compliance Gate, Project Template Provisioning, Progress Collector, Cross-Project Dependency Checker, Deliverable Link Checker) reads from and writes to specific SharePoint lists or libraries. Create and configure these before connecting the agent; the packages do not provision SharePoint content.

General steps, in order:

1. Create the list (or document library) in the target SharePoint site, or identify an existing one to reuse.
2. Add one column per row in the field-mapping table below for that agent, using the suggested SharePoint column type. Add only the columns you intend to populate; the agent omits unconfigured fields rather than inventing values for them.
3. Add the listed match-key column(s) as **Single line of text** (or **Number** where noted) and mark them required. If the platform supports enforcing uniqueness on a single-column key, enable it. SharePoint cannot natively enforce uniqueness across a composite (multi-column) key, so multi-column keys rely on the agent's own reconciliation logic; still index each key column for query performance.
4. Grant the environment's Work IQ SharePoint MCP connection the access level shown for each list/library: **Read** for lists or libraries the agent only reads, or **Contribute** for lists the agent creates, updates, or deletes rows in. Never grant **Full Control**; no agent needs it.
5. Record the site URL and list/library name (or GUID) where the deployed agent's configuration expects them. These values are never stored in the packaged assets or committed to source control; supply them when configuring the connection or the agent's runtime configuration.
6. For libraries that hold reference documents (project charters, meeting minutes, company standards) rather than list rows, confirm the documents are in a format the connector's file-content read capability supports, and that access is scoped to only that library.

Re-run this setup whenever an agent adds a new field to its field-mapping table or a new value to a Choice column.

### Portfolio List Maintainer

| List | Access | Match key |
| --- | --- | --- |
| Portfolio list | Contribute (create/update rows) | Project file reference (Single line of text, required, unique) |

| Field | Suggested SharePoint column type |
| --- | --- |
| Project file reference | Single line of text |
| Project file name | Single line of text |
| Project file link | Hyperlink |
| Project title | Single line of text |
| Start date | Date and Time |
| Finish date | Date and Time |
| Status date | Date and Time |
| Overall % complete | Number (Percentage format) |
| Next milestone | Single line of text |
| Next milestone date | Date and Time |

### Task List Synchronizer

| List | Access | Match key |
| --- | --- | --- |
| Task list | Contribute (create/update/delete rows) | Project file reference + Task UID (composite; add both as required columns) |

| Field | Suggested SharePoint column type |
| --- | --- |
| Project file reference | Single line of text |
| Task UID | Number |
| Project title | Single line of text |
| Task name | Single line of text |
| Outline level or WBS | Single line of text |
| Start date | Date and Time |
| Finish date | Date and Time |
| Duration | Single line of text (or Number, in minutes) |
| % complete | Number (Percentage format) |
| Milestone flag | Yes/No |
| Predecessors | Multiple lines of text (plain text) |
| Assigned resources | Multiple lines of text (plain text); use Person or Group only if resource names map to organizational users |
| Deadline | Date and Time |
| Constraint | Single line of text |

### Project Intake Triage

| List | Access | Match key |
| --- | --- | --- |
| Intake list | Contribute (create/update rows) | Project file reference (Single line of text, required, unique) |

| Field | Suggested SharePoint column type |
| --- | --- |
| Project file reference | Single line of text |
| Project file name | Single line of text |
| Project title | Single line of text |
| Start date | Date and Time |
| Finish date | Date and Time |
| Task count | Number |
| Milestone count | Number |
| Resource count | Number |
| Assignment count | Number |
| Triage classification | Choice with exactly the values `attention`, `oversized`, `incomplete`, `standard` |
| Triage date | Date and Time |

### Change Watcher

| List | Access | Match key |
| --- | --- | --- |
| Task list (snapshot) | Read only — this agent never writes to it | Project file reference + Task UID (composite; the same list Task List Synchronizer maintains, if deployed) |
| Change-report list | Contribute (create rows only; this agent never updates or deletes existing rows) | none (append-only log) |

Change-report list fields:

| Field | Suggested SharePoint column type |
| --- | --- |
| Project file reference | Single line of text |
| Project title | Single line of text |
| Change date | Date and Time |
| Change kind | Choice with exactly the values `initial`, `changed`, `unchanged` |
| Added count | Number |
| Removed count | Number |
| Changed count | Number |
| Change summary | Multiple lines of text (plain text, large enough for a bounded list of changes) |

### Stakeholder Notifier

| List | Access | Match key |
| --- | --- | --- |
| Notification list | Contribute (create/update rows) | Project file reference + Audience + Notification date (composite; add all three as required columns) |

| Field | Suggested SharePoint column type |
| --- | --- |
| Project file reference | Single line of text |
| Project title | Single line of text |
| Audience | Single line of text (holds a resource name or the literal `project-manager`) |
| Notification date | Date and Time |
| Notification body | Multiple lines of text (plain text) |
| Item count | Number |

### Compliance Gate

| List | Access | Match key |
| --- | --- | --- |
| Gate-results list | Contribute (create/update rows) | Project file reference (Single line of text, required, unique) |

| Field | Suggested SharePoint column type |
| --- | --- |
| Project file reference | Single line of text |
| Project title | Single line of text |
| Verdict | Choice with exactly the values `passed`, `attention`, `failed` |
| Evaluation date | Date and Time |
| Failed gates | Multiple lines of text (plain text; one gate name per line) |
| Evidence summary | Multiple lines of text (plain text, large enough for a bounded summary) |

### Project Template Provisioning

| List/Library | Access | Notes |
| --- | --- | --- |
| Template library | Read | Source of approved MPP templates; the agent copies from here but never writes to it |
| Target library | Contribute (create files) | Destination for provisioned project files |
| Projects list | Contribute (create/update rows) | Match key: Project file reference (Single line of text, required, unique) |
| Project-documentation library | Read (optional) | Only needed when requests reference a charter or meeting-minutes document; scope narrowly, since its contents are read as evidence, never edited |
| Company-documents library | Read (optional) | Only needed when methodology/standards documents inform customization; organization-wide, not scoped to one project |

Projects list fields:

| Field | Suggested SharePoint column type |
| --- | --- |
| Project file reference | Single line of text |
| Project file name | Single line of text |
| Project file link | Hyperlink |
| Project title | Single line of text |
| Start date | Date and Time |
| Finish date | Date and Time |
| Template used | Single line of text |
| Provisioning date | Date and Time |
| Charter/meeting-minutes reference | Single line of text |
| Company standards reference | Single line of text |

The project-documentation and company-documents libraries hold ordinary Word, PDF, or plain-text files; no special columns are required on them beyond what the library template provides.

### Progress Collector

| List | Access | Match key |
| --- | --- | --- |
| Intake list | Contribute (create rows at request time, update at collection time) | Submission project file reference + Task UID + Submission assignee (composite; add all as required columns) |
| Outcome list | Contribute (create rows only) | none (append-only log) |

Intake list fields:

| Field | Suggested SharePoint column type |
| --- | --- |
| Submission project file reference | Single line of text |
| Submission task reference | Number (task UID); add a Single line of text fallback for task name |
| Submission assignee | Single line of text (or Person or Group if resource names map to organizational users) |
| Submission progress values | Number (percentComplete), Single line of text or Number (remainingDuration), Date and Time (actualFinish), Multiple lines of text (notes) |
| Submission status | Choice with exactly the values `pending`, `applied`, `rejected`, `skipped` |

Outcome list fields:

| Field | Suggested SharePoint column type |
| --- | --- |
| Outcome project file reference | Single line of text |
| Outcome run date | Date and Time |
| Outcome counts | Number (one column each for applied/rejected/skipped, or a single summary text column) |
| Outcome detail | Multiple lines of text (plain text, large enough for a bounded summary) |

### Cross-Project Dependency Checker

| List | Access | Match key |
| --- | --- | --- |
| Dependency register | Contribute (create/update/delete rows, scoped per plan on re-publish) | Plan file reference + Declaration kind + Task or milestone UID (composite; add all as required columns) |
| Outcome list | Contribute (create rows only) | none (append-only log) |

Dependency register fields:

| Field | Suggested SharePoint column type |
| --- | --- |
| Plan file reference | Single line of text |
| Plan title | Single line of text |
| Declaration kind | Choice with exactly the values `provides`, `requires` |
| Task or milestone UID | Number |
| Name | Single line of text |
| Date | Date and Time |
| Referenced provider milestone | Single line of text (recommend storing as `providerFile::providerTaskUid`, or split into two columns) |
| Declaration updated | Date and Time |

Suggested outcome list columns, derived from this agent's response style: Check date (Date and Time), Overall status (Choice: `healthy`, `at-risk`, `broken`), Satisfied/Unsatisfied/At-risk counts (Number), Findings summary citing both endpoint identities (Multiple lines of text), Coverage gaps (Multiple lines of text).

### Deliverable Link Checker

| List | Access | Match key |
| --- | --- | --- |
| Deliverable register | Contribute (create/update/delete rows, scoped per plan on re-publish) | Plan file reference + Declaration kind + Deliverable key (composite; add all as required columns) |
| Outcome list | Contribute (create rows only); a Power Automate flow or SharePoint alert on this list is how a project manager learns of a change | none (append-only log) |

Deliverable register fields:

| Field | Suggested SharePoint column type |
| --- | --- |
| Plan file reference | Single line of text |
| Plan title | Single line of text |
| Declaration kind | Choice with exactly the values `deliverable-provides`, `deliverable-requires` |
| Task UID | Number |
| Task name | Single line of text |
| Deliverable key | Single line of text (must be the same custom field alias across every registered plan) |
| Task date | Date and Time |
| Declaration updated | Date and Time |
| Previous classification | Single line of text or Choice with exactly `satisfied`, `unsatisfied`, `at-risk` |
| Changed since last check | Yes/No |

Suggested outcome list columns, derived from this agent's response style: Check date (Date and Time), Overall status (Choice: `healthy`, `at-risk`, `broken`), Satisfied/Unsatisfied/At-risk counts (Number), Changed requirements summary citing consuming plan identity and deliverable key (Multiple lines of text), Coverage gaps (Multiple lines of text). If you configure a SharePoint alert on `Changed since last check`, set it on this outcome list, not the register.

## Agent Target Matrix

| Agent | Standard Agent | Agent |
| --- | --- | --- |
| Project Manager Assistant | Yes | Yes |
| Schedule Quality Analyst | Yes | Yes |
| Resource Manager | No | Yes |
| Portfolio and Executive Analyst | Yes | Yes |
| Project Plan Editor | No | Yes |
| Project Schedule Generator | No | Yes |
| MPP Data Auditor | Yes | Yes |
| Portfolio List Maintainer | Yes | No |
| Task List Synchronizer | Yes | No |
| Project Intake Triage | Yes | No |
| Change Watcher | Yes | No |
| Stakeholder Notifier | Yes | No |
| Compliance Gate | Yes | No |
| Project Template Provisioning | Yes | No |
| Progress Collector | Yes | No |
| Cross-Project Dependency Checker | Yes | No |
| Deliverable Link Checker | Yes | No |

The catalog's `authoringTargets` field is authoritative for compilers and CI.

## Build Agent Assets

### GitHub Actions

The preferred build path is the **Build agent assets** workflow in `.github/workflows/build-solutions.yml`.

It runs for pull requests and pushes to `main`, and it can also be started manually with **Actions → Build agent assets → Run workflow**. The publisher prefix is fixed to `pds` because the exported MCP connector and connection-reference components use that identity.

The workflow:

1. Validates source and generated assets.
2. Builds one agent package ZIP per catalog agent under `dist/agent-packages/`.
3. Verifies every package contains `manifest.json`, `instructions.md`, `README.md`, and at least one skill file.
4. Stamps `VERSION.txt` as `1.0.<github.run_number>.<github.run_attempt>`.
5. Uploads `pds-project-ai-agent-packages` as a workflow artifact retained for 14 days.
6. On pushes to the repository's default branch, creates a GitHub Release tagged `agents-v<version>` containing the agent packages, checksums, and version metadata.

Download the artifact from the workflow run's **Artifacts** section. Package ZIP files are never committed to the repository.

### Local build

Run:

```sh
npm run package:agents
```

This regenerates the Copilot Studio bundles and Agent templates, then packages every catalog agent into `dist/agent-packages/`. It does not import, publish, push, or deploy an agent and does not require an authenticated environment. Output directories are ignored build artifacts and must not be committed.

## 1. Choose an Agent Bundle

Open one directory under `build/copilot-studio/`:

- `project-manager-assistant`: operational delivery reporting.
- `schedule-quality-analyst`: schedule assurance and data-quality analysis.
- `resource-manager`: resource demand, capacity, and assignment reporting.
- `portfolio-executive-analyst`: executive and master-project reporting.
- `mpp-data-auditor`: read-only entity and custom-field assurance.
- `project-plan-editor`: guarded draft and commit workflows.

Review its `manifest.json` before configuring Copilot Studio:

- `title` and `description` define the agent identity.
- `access` defines the maximum permission boundary.
- `tools` is the MCP tool allowlist for the agent.
- `topics` maps generated workflow files to their source skills.

## 2. Create the Agent

1. In Copilot Studio, go to **Agents** and create a blank agent.
2. Use `title` and `description` from `manifest.json`.
3. Enable generative orchestration.
4. On the agent **Overview** page, edit **Instructions**.
5. Paste the complete contents of the bundle's `instructions.md`.
6. Save the agent.

Do not paste `agent.json`, `manifest.json`, or all topic files into the main instructions field.

## 3. Add PDS Project AI as an MCP Tool

1. Open the agent's **Tools** page.
2. Select **Add a tool**, **New tool**, then **Model Context Protocol**.
3. Configure the deployed PDS Project AI MCP endpoint and connection.
4. Use end-user authentication so API authorization remains scoped to the signed-in user.
5. Save the MCP tool and verify that its tools appear in the MCP tool details.

## 4. Apply the Tool Allowlist (optional)

Compare the MCP tools shown in Copilot Studio with the `tools` array in `manifest.json`.

1. Enable only the listed tools when the environment supports individual MCP tool controls.
1. Disable unrelated tools.
1. For the Project Plan Editor, set **Ask the end user before running** for `commit_edit_draft`.
1. Keep confirmation enabled for other externally visible write actions where available.

### MCP ALM behavior

Each agent connects to the PDS Project AI MCP server through a connection you create in the target environment. Credentials, OAuth consent, and connection instances are never stored in the packages or templates. After manual setup or template deployment, create or authorize the connector connection in the target environment.

## Agent templates

Agents use PAC's internal `cli-copilot` authoring model. A normal unmanaged solution export can omit their inline skills and MCP tool binding, so the compiler emits complete `BotDefinition` YAML templates instead.

The extracted template includes the portable authoring model required to recreate the agent:

- `DialogComponent` with `dialog.kind: McpTool` for the PDS Project AI MCP server.
- `DialogComponent` with `dialog.kind: InlineAgentSkill` for each coding-agent skill.
- `connectionReferences` and `connectorDefinitions` used by the MCP tool.
- `entity.configuration.authoringModel: CliCopilot` and the agent instruction segments.

Generate templates locally:

```sh
npm run compile:agents
npm run verify:agents
```

Templates are written to ignored `build/agent-templates/`. Each contains sanitized generated IDs, one native `McpTool`, and all mapped `SKILL.md` files as `InlineAgentSkill` components. Connection and custom-connector IDs remain deployment placeholders.

The placeholders are optional: you can deploy a template as-is and bind the connection afterwards in Copilot Studio. Supplying real values at deployment time just makes the binding correct from the start. To create an Agent in a designated non-production environment with values substituted, set the deployment variables and run the guarded helper:

```powershell
$env:PDS_POWER_PLATFORM_ENVIRONMENT = 'https://your-dev-environment.crm.dynamics.com'
$env:PDS_POWER_PLATFORM_AGENT_SOLUTION = 'PDSGeneratedAgents'
$env:PDS_AGENT_CONNECTION_ID = '<target-environment-connection-id>'
$env:PDS_AGENT_CUSTOM_CONNECTOR_ID = '<target-environment-custom-connector-id>'

npm run deploy:agents -- --confirm --agent mpp-data-auditor
```

After creation, export the unmanaged solution with `pac solution export`. This workflow requires authentication and mutates the selected development environment; unlike `pac copilot pack`, it isn't an offline build.

Omit `--agent` to create every catalog Agent. This command mutates the target environment and refuses to run without `--confirm`.

Raw extracted templates can contain environment-specific IDs, audit identities, synchronization data, and concrete connection IDs. They remain ignored. Generated templates remove those fields and leave deployment placeholders in their place.

## 5. Apply Workflow Topics

Copilot Studio agents using the standard harness do not load coding-agent `SKILL.md` files. The files under `topics/` are condensed authoring specifications, not directly importable topic definitions.

For each topic listed in `manifest.json`:

1. Open its generated Markdown file under `topics/`.
2. Create a Copilot Studio topic for deterministic multi-step orchestration, or a prompt tool for a focused single-turn analysis.
3. Use **When to use** and **When not to use** as routing and trigger guidance.
4. Implement **Procedure** with the configured MCP tools. In instructions, type `/` to reference a configured tool explicitly where needed.
5. Apply **Guardrails**, **Response format**, and **Failure handling** to the topic or prompt instructions.
6. Keep the generated workflow name so evaluation cases remain traceable.

For workflows that use several MCP calls, require pagination, or include cleanup, prefer a topic or Agent over a single prompt tool.

## 6. Configure Editing Safety

For `project-plan-editor`:

1. Keep draft-authoring workflows separate from `mpp-safe-commit`.
2. Require preview and validation after every draft change.
3. Ask the user to confirm the exact validated draft, destination, and overwrite behavior.
4. Run `commit_edit_draft` only after that confirmation.
5. Preserve the same idempotency key during a retry.
6. Stop on an ETag or concurrency conflict instead of overwriting newer content.

The five read-only agents must not receive `Session.ReadWrite` authorization.

## 7. Test Before Publishing

Use the Copilot Studio test pane with the cases in `examples/evaluations.json` from this repository. Each agent package ZIP also carries its own cases compiled into the `README.md` test section.

For every applicable case, verify:

1. The expected workflow is selected.
2. Required MCP inputs are collected rather than invented.
3. Forbidden write tools are not called.
4. Results include stable entity identifiers and data limitations.
5. Sessions created by the workflow are closed when no longer needed.
6. The Project Plan Editor does not commit before confirmation.

Also test invalid files, expired sessions, incomplete pagination, unavailable child projects, authentication failures, and quota errors.

## 8. Publish and Maintain

1. Publish the agent only after its evaluation cases pass.
2. After changing a source skill, catalog entry, or base agent instruction, run `npm run compile`.
3. Review and commit only the canonical source changes; compiled bundles remain ignored.
4. Run `npm test`; CI recompiles bundles and rejects invalid access mappings.
5. Reapply changed generated instructions or topics in Copilot Studio and retest before republishing.

Never store tenant IDs, client secrets, connection values, private endpoints, or customer MPP data in these bundles.