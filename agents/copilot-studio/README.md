# Apply Generated Assets in Copilot Studio

The repository supports both Copilot Studio authoring products:

- **Standard Agent:** rule-based conversational agents with predefined topics and flows. These compile to offline unmanaged solution ZIP files.
- **Agent:** skill-oriented agents for complex actions and human-facing interaction. These compile to `BotDefinition` YAML templates containing native inline skills and an MCP tool.

The packaged agents are cloned from the audited canonical unmanaged seed in `seeds/power-platform/`. Each package includes the generated main instructions with the full workflow procedures embedded, the PDS Project AI MCP custom connector, its agent connection-reference binding, the generic MCP tool, one triggerable topic per mapped skill, and one native MCP TaskDialog tool per mapped skill. The repository `SKILL.md` files remain source specifications; their compiled topics and tools appear in Copilot Studio after import.

## Prerequisites

- Access to Microsoft Copilot Studio and permission to create agents and connections.
- A deployed PDS Project AI MCP endpoint.
- An OAuth connection authorized for `Session.ReadOnly` or `Session.ReadWrite`, according to the selected agent.
- Compiled bundles produced with `npm run compile` under ignored `build/copilot-studio/`.
- Power Platform CLI 2.12.1 or newer on `PATH`, or `PAC_CLI_PATH` set to the CLI executable, when building solution ZIP files.

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

The catalog's `authoringTargets` field is authoritative for compilers and CI.

## Build Agent Assets

### GitHub Actions

The preferred build path is the **Build agent assets** workflow in `.github/workflows/build-solutions.yml`.

It runs for pull requests and pushes to `main`, and it can also be started manually with **Actions → Build agent assets → Run workflow**. The publisher prefix is fixed to `pds` because the exported MCP connector and connection-reference components use that identity.

The workflow:

1. Installs the pinned Power Platform CLI version.
2. Validates source and generated assets.
3. Sets solution version `1.0.<github.run_number>.<github.run_attempt>`.
4. Builds four Standard Agent unmanaged solution ZIP files and six Agent templates.
5. Verifies that every solution contains `Managed=0` and the expected version.
6. Creates `SHA256SUMS.txt` and `VERSION.txt`.
7. Uploads `pds-project-ai-unmanaged-solutions` as a workflow artifact retained for 14 days.
8. On pushes to the repository's default branch, creates a GitHub Release tagged `solutions-v<version>` containing Standard Agent ZIPs, Agent templates, checksums, and version metadata.

Download the artifact from the workflow run's **Artifacts** section. Solution ZIP files are never committed to the repository.

### Standard Agent local build

Run:

```sh
npm run compile:solutions
```

This local-only command:

1. Regenerates the portable Copilot Studio bundles.
2. Clones the audited exported seed into Standard Agent workspaces under `build/power-platform/`.
3. Replaces seed identity and instructions, embeds the full workflow procedures from the compiled topic files into the agent instructions, then adds one triggerable topic and one native MCP TaskDialog tool per mapped skill.
4. Packages four unmanaged solution ZIP files under `dist/solutions/` and validates them with PAC.

The default output files are:

- `PDSProjectManagerAssistantStandard.zip`
- `PDSScheduleQualityAnalystStandard.zip`
- `PDSPortfolioExecutiveAnalystStandard.zip`
- `PDSMppDataAuditorStandard.zip`

The command does not import, publish, push, or deploy an agent. It does not require an authenticated environment. Both output directories are ignored build artifacts and must not be committed.

Local builds default to solution version `1.0.0.1`. Override it with a four-part numeric version:

```powershell
$env:PDS_POWER_PLATFORM_SOLUTION_VERSION = '1.0.123.2'
npm run compile:solutions
```

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

Use these permission boundaries:

| Bundle | OAuth scope |
| --- | --- |
| All read-only bundles | `Session.ReadOnly` |
| `project-plan-editor` | `Session.ReadWrite` |

OAuth scope enforcement is the security boundary. Agent instructions are behavioral guidance, not authorization.

## 4. Apply the Tool Allowlist

Compare the MCP tools shown in Copilot Studio with the `tools` array in `manifest.json`.

1. Enable only the listed tools when the environment supports individual MCP tool controls.
2. Disable unrelated tools.
3. For read-only agents, do not authorize `Session.ReadWrite` even if write tools remain visible in the MCP inventory.
4. For the Project Plan Editor, set **Ask the end user before running** for `commit_edit_draft`.
5. Keep confirmation enabled for other externally visible write actions where available.

If individual MCP tools cannot be disabled, rely on OAuth scopes and server-side authorization to enforce the boundary.

### MCP ALM behavior

The canonical seed was exported from a non-production environment after creating the solution-aware MCP custom connector and binding it to a Standard Agent. The compiler preserves those exported component IDs and dependency mappings while cloning the agent and adding workflow tools.

After import, create or authorize the connector connection in the target environment. Credentials, OAuth consent, and connection instances aren't stored in the seed or generated ZIPs.

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

To create an Agent in a designated non-production environment, set the required deployment values and run the guarded helper:

```powershell
$env:PDS_POWER_PLATFORM_ENVIRONMENT = 'https://your-dev-environment.crm.dynamics.com'
$env:PDS_POWER_PLATFORM_AGENT_SOLUTION = 'PDSGeneratedAgents'
$env:PDS_AGENT_CONNECTION_ID = '<target-environment-connection-id>'
$env:PDS_AGENT_CUSTOM_CONNECTOR_ID = '<target-environment-custom-connector-id>'

npm run deploy:agents -- --confirm --agent mpp-data-auditor
```

After creation, export the unmanaged solution with `pac solution export`. This workflow requires authentication and mutates the selected development environment; unlike `pac copilot pack`, it isn't an offline build.

Omit `--agent` to create every catalog Agent. This command mutates the target environment and refuses to run without `--confirm`.

Raw extracted templates can contain environment-specific IDs, audit identities, synchronization data, and concrete connection IDs. They remain ignored. Generated templates remove those fields and require target-environment connector values at deployment time.

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

Use the Copilot Studio test pane with the cases in `examples/evaluations.json`.

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