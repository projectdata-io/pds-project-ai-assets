# Apply Generated Assets in Copilot Studio

The compiled directories are portable authoring bundles. Use `npm run compile:solutions` to turn their agent instructions into CLI-authored Copilot Studio workspaces and unmanaged Microsoft Power Platform solution ZIP files.

The packaged agents include their generated main instructions. MCP connections, authentication, and the Markdown workflow specifications under `topics/` still require environment-specific configuration after import.

## Prerequisites

- Access to Microsoft Copilot Studio and permission to create agents and connections.
- A deployed PDS Project AI MCP endpoint.
- An OAuth connection authorized for `Session.ReadOnly` or `Session.ReadWrite`, according to the selected agent.
- Compiled bundles produced with `npm run compile` under ignored `build/copilot-studio/`.
- Power Platform CLI 2.12.1 or newer on `PATH`, or `PAC_CLI_PATH` set to the CLI executable, when building solution ZIP files.

## Build Unmanaged Solution ZIP Files

### GitHub Actions

The preferred build path is the **Build unmanaged solutions** workflow in `.github/workflows/build-solutions.yml`.

It runs for pull requests and pushes to `main`, and it can also be started manually with **Actions → Build unmanaged solutions → Run workflow**. A manual run can override the default `pds` publisher prefix.

The workflow:

1. Installs the pinned Power Platform CLI version.
2. Validates source and generated assets.
3. Builds all six CLI-authored workspaces and unmanaged solution ZIP files.
4. Verifies that every solution contains `Managed=0`.
5. Creates `SHA256SUMS.txt`.
6. Uploads `pds-project-ai-unmanaged-solutions` as a workflow artifact retained for 14 days.

Download the artifact from the workflow run's **Artifacts** section. Solution ZIP files are never committed to the repository.

### Local build

Run:

```sh
npm run compile:solutions
```

This local-only command:

1. Regenerates the portable Copilot Studio bundles.
2. Runs `pac copilot init` without an environment to create six CLI-authored workspaces under `build/power-platform/`.
3. Runs `pac copilot pack` to create six unmanaged solution ZIP files under `dist/solutions/`.

The default output files are:

- `PDSProjectManagerAssistant.zip`
- `PDSScheduleQualityAnalyst.zip`
- `PDSResourceManager.zip`
- `PDSPortfolioExecutiveAnalyst.zip`
- `PDSMppDataAuditor.zip`
- `PDSProjectPlanEditor.zip`

The command does not import, publish, push, or deploy an agent. It does not require an authenticated environment. Both output directories are ignored build artifacts and must not be committed.

Set a different publisher prefix when needed:

```sh
PDS_POWER_PLATFORM_PUBLISHER_PREFIX=contoso npm run compile:solutions
```

On PowerShell:

```powershell
$env:PDS_POWER_PLATFORM_PUBLISHER_PREFIX = 'contoso'
npm run compile:solutions
```

The prefix must contain 2-8 alphanumeric characters, start with a letter, and not start with `mscrm`.

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

## 5. Apply Workflow Topics

Copilot Studio agents using the standard harness do not load coding-agent `SKILL.md` files. The files under `topics/` are condensed authoring specifications, not directly importable topic definitions.

For each topic listed in `manifest.json`:

1. Open its generated Markdown file under `topics/`.
2. Create a Copilot Studio topic for deterministic multi-step orchestration, or a prompt tool for a focused single-turn analysis.
3. Use **When to use** and **When not to use** as routing and trigger guidance.
4. Implement **Procedure** with the configured MCP tools. In instructions, type `/` to reference a configured tool explicitly where needed.
5. Apply **Guardrails**, **Response format**, and **Failure handling** to the topic or prompt instructions.
6. Keep the generated workflow name so evaluation cases remain traceable.

For workflows that use several MCP calls, require pagination, or include cleanup, prefer a topic or agent flow over a single prompt tool.

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