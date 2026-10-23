# PDS Project AI Assets

Public, reusable agent assets for working with Microsoft Project MPP files through the PDS Project AI MCP server.

## Repository layout

Agent publication automation, its dependencies, and tests live in this repository.
See [Playwright agent publication](docs/agent-publication-automation.md) for
`pnpm publish:agents`, interactive Edge login, explicit execution, and safe
partial-release recovery. Commands run from this repository's root, independently
of any parent connector repository.

- [x] Playwright publication automation: 14 safety tests and an isolated Edge fixture
  cover identical ZIP uploads, persisted readback, and duplicate-upload avoidance.
  Submodule-local preflight, strict TypeScript check, and Edge fixture pass.
  The full asset suite still fails existing Editor/Generator content validation;
  those checks were not weakened. Real-tenant automation acceptance remains pending;
  no publication was performed while relocating this tooling.
- [x] Catalog readiness no longer depends on an upload control for readback.
  Explicit login/access/CDN diagnostics and one read-only CDN retry preserve the
  no-upload-retry policy. Regression fixture covers hidden upload controls,
  button-free readback, transient/persistent CDN failures, and login/access denial.
  Evidence: 14 publication tests, strict TypeScript check, and isolated Edge
  fixture pass; parent connector suite: 493 passed, 1 skipped. Live read-only
  verification using the dedicated Edge profile confirms all four catalog
  versions (Manager/Auditor 2.3.9, Editor 2.3.10, Generator 2.3.15) and Everyone
  availability. The original timeout was not reproduced; full asset validation
  still fails existing Editor/Generator wording checks. No live uploads run.
- [x] Recognize embedded sign-in and MFA prompts during catalog readiness.
  The user confirmed the Editor timeout occurred on a sign-in/MFA screen;
  read-only diagnosis also reached Microsoft MFA. Added auth-frame/title/MFA
  regression cases and made `--login` verify both surfaces before success.
- [x] Recover once from a stalled catalog app-detail shell.
  Reproduced the exact read-only preflight failure: empty detail content,
  no upload control, and client-side MobX error 35 without a login prompt.
  Added a single read-only reload for that runtime failure or a 60-second stalled
  shell, with bounded persistent-failure coverage and listener cleanup. Upload
  retry and journal safety policies are unchanged.
  Evidence: 14 unit tests, strict TypeScript check, and Edge fixture pass;
  parent suite: 493 passed, 1 skipped. Asset suite retains existing package-content
  validation failures. Final live four-agent preflight was blocked separately by
  Developer Portal sign-in; live recovery is not claimed verified. No uploads run.

- `skills/`: multi-step, reusable workflows packaged as `SKILL.md` files.
- `agents/`: role-focused agent definitions and Copilot Studio instruction sets.
- `prompts/`: focused, parameterized prompt templates.
- `examples/`: sample configurations and expected outputs using synthetic data.
- `schemas/`: machine-readable schemas for asset metadata and validation.
- `templates/`: starting points for new assets.
- `scripts/`: repository validation utilities.
- `site/`: generated SvelteKit catalog published to GitHub Pages.
- `catalog.json`: machine-readable skill, tool, access, and agent mappings.

This repository's top-level folders are intentionally not VS Code workspace discovery locations. Consumers should install or copy selected assets into the location required by their agent platform.

All Teams packages use PDS MCP dynamic discovery: `functions: []`, `run_for_functions: ["*"]`, and no `spec.mcp_tool_description`. No Work IQ actions are included. Tool definitions come from the PDS server at runtime, not package allowlists or schema snapshots. See Microsoft's [discovery configuration](https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/plugin-dynamic-tool-discovery#plugin-manifest-differences).

Role instructions govern intended tool use, but are not an authorization boundary. Dynamic discovery can expose additional tools from any configured server, including write tools; OAuth consent, scopes, and server-side authorization determine executable access. Analysis roles must still avoid project-data changes, and report actions remain limited by instructions to requested report workflows. Backend deployment does not update installed agent packages: repackage, submit/approve the updated package, and test in a new Microsoft 365 Copilot conversation. Verify an actual `create_project_schedule` call and delivered MPP, not just successful discovery or a text schedule.

Read-only Teams agents start with a mandatory task-reference rule: identify tasks in chat and reports by Task ID (`id`, not `uid`) and name, adding WBS/outline number when available. Resolve internal dependency, assignment, and forensic UIDs to task rows before presentation and check outgoing findings for UID-only citations. If lookup fails, disclose the gap rather than substituting UID-only lists. UIDs remain internal tool/matching keys except on explicit request or for UID-integrity evidence. Backend MCP read responses also reinforce this rule, including in compact M365 JSON text; publish the updated packages and deploy the backend through its CI workflow. Static validation alone does not demonstrate live model behavior.

## Available agents

Each agent packages role-focused instructions, an MCP tool allowlist, and mapped workflows for Copilot Studio. Standard Agents are created manually; Agents can also be deployed from a generated `BotDefinition` template.

| Agent                            | What it does                                                                                              | Standard Agent | Agent |
| -------------------------------- | --------------------------------------------------------------------------------------------------------- | -------------- | ----- |
| Project Manager Assistant        | Status, milestones, lookahead, dependencies, and near-term attention.                                     | Yes            | Yes   |
| Schedule Quality Analyst         | Schedule logic, constraints, realism, and data-quality assurance.                                         | Yes            | Yes   |
| Resource Manager                 | Resource demand, capacity, and assignment reporting.                                                      | No             | Yes   |
| Portfolio and Executive Analyst  | Executive status, master-project rollup, and variance reporting.                                          | Yes            | Yes   |
| Project Plan Editor              | Apply requested MPP edits and report the committed result.                                                | No             | Yes   |
| Project Schedule Generator       | Generate and commit project schedules from user requirements.                                             | No             | Yes   |
| MPP Data Auditor                 | Read-only entity, hierarchy, and custom-field assurance.                                                  | Yes            | Yes   |
| Portfolio List Maintainer        | Keeps a SharePoint portfolio list in sync from changed MPP files.                                         | Yes            | No    |
| Task List Synchronizer           | Syncs MPP tasks into a SharePoint task list, including deletions.                                         | Yes            | No    |
| Project Intake Triage            | Profiles newly added MPP files and records a triage classification.                                       | Yes            | No    |
| Change Watcher                   | Diffs updated MPP files against the last sync and records a change report.                                | Yes            | No    |
| Stakeholder Notifier             | Derives per-audience notification entries from updated MPP files.                                         | Yes            | No    |
| Compliance Gate                  | Evaluates plans against schedule quality gates and records the verdict.                                   | Yes            | No    |
| Project Template Provisioning    | Provisions new project files from approved templates, with guarded customization.                         | Yes            | No    |
| Progress Collector               | Seeds SharePoint progress requests from a plan, then applies submitted updates in one batch.             | Yes            | No    |
| Cross-Project Dependency Checker | Keeps a shared dependency register and reports broken cross-project links.                                | Yes            | No    |
| Deliverable Link Checker         | Keeps a shared deliverable-key register and reports broken soft cross-project links.                      | Yes            | No    |

Agent sources live under [`agents/copilot-studio/`](agents/copilot-studio/). See [Apply Generated Assets in Copilot Studio](agents/copilot-studio/README.md) for setup, and the [available workflow specifications](#available-workflow-specifications) below for the skills each agent can run.

## Available workflow specifications

These `SKILL.md` files are reusable workflow specifications. Copilot Studio agents using the standard harness do not import them as native skills, topics, or tools.

| Skill                                                                                      | Purpose                                                                                                                   |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| [`mpp-project-summary`](skills/mpp-project-summary/SKILL.md)                               | Summarize project dates, progress, milestones, effort, cost, and key concerns.                                            |
| [`mpp-schedule-health`](skills/mpp-schedule-health/SKILL.md)                               | Assess overdue work, stale progress, constraints, deadlines, slack, and status consistency.                               |
| [`mpp-critical-path-analysis`](skills/mpp-critical-path-analysis/SKILL.md)                 | Analyze critical tasks, slack, predecessor chains, and finish drivers.                                                    |
| [`mpp-resource-capacity`](skills/mpp-resource-capacity/SKILL.md)                           | Review overallocations, assignment load, availability, and workload concentration.                                        |
| [`mpp-executive-status-report`](skills/mpp-executive-status-report/SKILL.md)               | Produce an evidence-based sponsor or steering status report.                                                              |
| [`mpp-safe-commit`](skills/mpp-safe-commit/SKILL.md)                                       | Stage, validate, and commit requested MPP edits.                                                        |
| [`mpp-milestone-review`](skills/mpp-milestone-review/SKILL.md)                             | Review upcoming, missed, completed, and dependency-exposed milestones.                                                    |
| [`mpp-baseline-variance`](skills/mpp-baseline-variance/SKILL.md)                           | Compare current schedule, work, and cost values with saved baselines.                                                     |
| [`mpp-earned-value-analysis`](skills/mpp-earned-value-analysis/SKILL.md)                   | Analyze stored and calculated earned-value performance measures.                                                          |
| [`mpp-progress-audit`](skills/mpp-progress-audit/SKILL.md)                                 | Find contradictory, incomplete, and stale project status data.                                                            |
| [`mpp-cost-review`](skills/mpp-cost-review/SKILL.md)                                       | Review current, actual, remaining, baseline, fixed, and overtime costs.                                                   |
| [`mpp-calendar-analysis`](skills/mpp-calendar-analysis/SKILL.md)                           | Explain working time, exceptions, work weeks, and calendar inheritance.                                                   |
| [`mpp-wbs-analysis`](skills/mpp-wbs-analysis/SKILL.md)                                     | Analyze hierarchy, work packages, rollups, and outline anomalies.                                                         |
| [`mpp-master-project-navigation`](skills/mpp-master-project-navigation/SKILL.md)           | Navigate read-only master-project graphs and child project data.                                                          |
| [`mpp-data-quality-audit`](skills/mpp-data-quality-audit/SKILL.md)                         | Audit identifiers, relationships, dates, hierarchy, and planning completeness.                                            |
| [`mpp-custom-field-analysis`](skills/mpp-custom-field-analysis/SKILL.md)                   | Discover and analyze custom fields, aliases, and extended attributes.                                                     |
| [`mpp-lookahead-report`](skills/mpp-lookahead-report/SKILL.md)                             | Report upcoming work, milestones, handoffs, and near-term resource demand.                                                |
| [`mpp-plan-comparison`](skills/mpp-plan-comparison/SKILL.md)                               | Compare two plans while preserving identity and match confidence.                                                         |
| [`mpp-change-impact-report`](skills/mpp-change-impact-report/SKILL.md)                     | Explain previewed draft effects and validation status before commit.                                                      |
| [`mpp-create-project`](skills/mpp-create-project/SKILL.md)                                 | Create and validate a new project draft from explicit requirements.                                                       |
| [`mpp-progress-editor`](skills/mpp-progress-editor/SKILL.md)                               | Stage and validate explicit task progress updates.                                                                        |
| [`mpp-schedule-editor`](skills/mpp-schedule-editor/SKILL.md)                               | Stage and validate task, hierarchy, duration, and dependency edits.                                                       |
| [`mpp-resource-editor`](skills/mpp-resource-editor/SKILL.md)                               | Stage and validate resource and assignment edits.                                                                         |
| [`mpp-draft-repair`](skills/mpp-draft-repair/SKILL.md)                                     | Repair structured draft validation issues without committing.                                                             |
| [`mpp-dependency-audit`](skills/mpp-dependency-audit/SKILL.md)                             | Audit dependency completeness, integrity, cycles, lag, and handoffs.                                                      |
| [`mpp-constraint-review`](skills/mpp-constraint-review/SKILL.md)                           | Review constraints, deadlines, date restrictions, and schedule exposure.                                                  |
| [`mpp-project-manager-brief`](skills/mpp-project-manager-brief/SKILL.md)                   | Produce an operational briefing for near-term project delivery.                                                           |
| [`mpp-resource-manager-report`](skills/mpp-resource-manager-report/SKILL.md)               | Report staffing demand, availability, assignment load, and decisions.                                                     |
| [`mpp-portfolio-rollup`](skills/mpp-portfolio-rollup/SKILL.md)                             | Roll up resolved master-project nodes without double-counting.                                                            |
| [`mpp-portfolio-list-maintenance`](skills/mpp-portfolio-list-maintenance/SKILL.md)         | Build a deterministic portfolio-list payload from a created or updated MPP file.                                          |
| [`mpp-task-list-sync`](skills/mpp-task-list-sync/SKILL.md)                                 | Synchronize an MPP task schedule into a configured SharePoint task list.                                                  |
| [`mpp-project-intake-triage`](skills/mpp-project-intake-triage/SKILL.md)                   | Profile a newly added MPP file and record a rule-based triage classification.                                             |
| [`mpp-change-watch-report`](skills/mpp-change-watch-report/SKILL.md)                       | Diff an updated MPP file against its task-list snapshot and record a change report.                                       |
| [`mpp-stakeholder-notification`](skills/mpp-stakeholder-notification/SKILL.md)             | Derive per-audience notification entries from an updated MPP file.                                                        |
| [`mpp-compliance-gate-check`](skills/mpp-compliance-gate-check/SKILL.md)                   | Evaluate an updated MPP file against schedule quality gates and record the verdict.                                       |
| [`mpp-project-template-provisioning`](skills/mpp-project-template-provisioning/SKILL.md)   | Provision a new project file by copying an approved MPP template, then customize it through guarded drafts.               |
| [`mpp-progress-collection`](skills/mpp-progress-collection/SKILL.md)                       | Collect team-reported progress from a SharePoint intake list and apply it to the source plan in one batch.                |
| [`mpp-progress-request`](skills/mpp-progress-request/SKILL.md)                             | Seed a SharePoint intake list with per-resource progress request rows from a plan's active assignments.                   |
| [`mpp-dependency-register-publish`](skills/mpp-dependency-register-publish/SKILL.md)       | Publish a plan's provided milestones and required external dependencies to a shared register.                             |
| [`mpp-cross-project-dependency-check`](skills/mpp-cross-project-dependency-check/SKILL.md) | Evaluate cross-project requirements against the shared dependency register and record the verdict.                        |
| [`mpp-deliverable-register-publish`](skills/mpp-deliverable-register-publish/SKILL.md)     | Publish a plan's declared deliverable keys to a shared deliverable register, independent of native Project Server fields. |
| [`mpp-deliverable-link-check`](skills/mpp-deliverable-link-check/SKILL.md)                 | Evaluate declared deliverable-key links against the shared register and record the verdict.                               |
| [`mpp-schedule-realism-review`](skills/mpp-schedule-realism-review/SKILL.md)               | Review schedule logic, modeling quality, assumptions, and realism.                                                        |

## Development

Requirements: Node.js 20 or newer.

```sh
npm run compile
npm run compile:agents
npm run package:agents
npm run site:build
npm test
```

See [CONTRIBUTING.md](CONTRIBUTING.md) before adding an asset.

Run `npm run compile` to create transient Copilot Studio bundles under ignored `build/copilot-studio/`. `npm test` checks catalog coverage, MCP tool references, access boundaries, agent mappings, synthetic evaluation references, prohibited public artifacts, and compiled bundle consistency. Pull requests and pushes to `main` run the same validation in GitHub Actions.

`npm run compile:agents` builds complete `BotDefinition` YAML templates for catalog agents targeted as **Agent**, with mapped `SKILL.md` files represented as native `InlineAgentSkill` components. `npm run package:agents` packages every catalog agent into a ZIP under `dist/agent-packages/` containing the agent instructions, manifest, full skill files, a manual setup guide, and the `BotDefinition` template where applicable.

The **Build agent assets** GitHub Actions workflow is the preferred packaging path. It versions packages as `1.0.<github.run_number>.<github.run_attempt>`, uploads the agent package ZIPs as temporary artifacts, and creates a versioned GitHub Release on default-branch pushes. Build outputs are not stored in source control.

The same workflow builds and deploys the static agent catalog to GitHub Pages on every default-branch push. Run `npm install --prefix site` once before using `npm run site:dev`, `npm run site:check`, or `npm run site:build` locally.

## Microsoft 365 Declarative-Agent Packages

`apps/` contains seven independently deployable `PDS Project AI` packages:

- `teams-project-manager-assistant`
- `teams-schedule-quality-analyst`
- `teams-portfolio-executive-analyst`
- `teams-resource-manager`
- `teams-mpp-data-auditor`
- `teams-project-plan-editor`
- `teams-project-schedule-generator`

Every package has exactly one `copilotAgents.declarativeAgents` manifest entry, one package-local `m365agents.yml` lifecycle, a unique `MCP_DA_AUTH_ID_*` DCR binding, and role-specific generated instructions and artwork. All seven use native, read-only Microsoft 365 capabilities to search the signed-in user's accessible SharePoint and OneDrive files, email, and Teams conversations for relevant project context. The five analysis packages use PDS for analysis and Code Interpreter for user-requested report attachments. Their instructions prohibit project-data changes; discovered tool availability is not restricted by a package allowlist. Project Plan Editor and Project Schedule Generator use PDS tools and execute clear requests after internally validating them; they ask only for missing or ambiguous inputs. They do not generate reports or documents. All seven reuse the PDS MCP endpoint and metadata-only project-plan picker.

### Editor workflow structure

The two Teams editors receive short role instructions plus one self-contained MCP procedure. Tools are discovered dynamically; skill mappings document workflows rather than restrict the runtime tool surface. Teams does not load the skill files or invoke skill handoffs. Existing drafts are reused; draft-only requests never authorize commit. New tasks/resources are committed to the session and read back when their persisted UIDs are needed for dependencies or assignments. Only the final stage writes to a provider or presents the completed download.

Schedule Generator asks only for missing scheduling inputs or estimate approval, never a save location or delivery choice. It omits provider targets during creation and follow-up commits, then always calls `open_project_plan_download` as its final tool action. The delivery card defaults to OneDrive and offers OneDrive / SharePoint / Download tabs; users choose a destination and explicitly save there. Opening the card is not proof of a cloud save. Publish the updated Generator package to apply the instructions; deploy the backend separately for the updated cards.

Editor/Generator return an ordinary filename/project-session receipt alongside delivery and explain "Show the download again" recovery using the same available session, never regeneration. Confirmed card cloud saves request an ordinary linked assistant confirmation without another write. Picker-created sessions are carried in text as well as model context; analysis agents read that receipt, continue pending analysis with `get_project`, and retain the selected session for follow-ups instead of asking for reselection solely because structured context is absent. These changes require both backend deployment and updated agent publication; they do not make host-managed cards permanent or extend session retention.

For generated Copilot Studio templates with native skills, authoring skills stage and validate changes and return the draft IDs. `mpp-safe-commit` reuses those IDs instead of rebuilding the draft; `mpp-draft-repair` returns the corrected draft to its caller without authorizing persistence. Session ownership follows the workflow, and sessions remain open while a download or follow-up needs them.

### Analysis workflow structure

The five read-only Teams agents receive concise role-specific analysis criteria, one shared MCP query/recovery procedure, and one report-delivery procedure. They call tools directly rather than referring to unavailable skills. Complete-page coverage, entity UIDs, reporting dates/units, source grounding, and explicit session-error recovery apply across roles. Project changes remain prohibited; session lifecycle operations and generating temporary report attachments are separate from project edits.

Use Code Interpreter to generate requested Word (.docx), PDF, Excel, and PowerPoint reports. Verify the actual file exists, is non-empty, and matches the requested format before returning its attachment. If generation fails, report the actual error rather than claiming a file exists. Reports are temporary downloads; users save them to OneDrive or SharePoint manually. Do not ask for report destinations or claim automatic cloud saving. Skill files remain available unchanged to skill-capable hosts and generated native-skill templates.

All five analytics role prompts include tailored PMI-aligned recommendations for their discipline, with an explicit public PMBOK Guide reference basis and no invented PMI thresholds, clause citations, or certification claims. The same role guidance reaches Teams packages, Copilot Studio instruction bundles, and native-skill templates. See [PMI-Aligned Analytics](docs/pmi-analysis-guidance.md) for verified public sources, role applications, and live acceptance scenarios.

Project Schedule Generator and its creation skill also apply PMI-aligned planning to agreed scope/deliverables, dependency logic, estimates, resource/calendar assumptions, and decision milestones. This does not change the authorized MCP workflow or make a committed MPP an approved baseline. Unsupported planning features and remaining governance decisions are disclosed explicitly.

On Windows, run `./scripts/build-teams-icons.ps1` to render the canonical role icon pairs in `shared/agent-icons/` from the original `shared/user-ui-icons/` artwork. Run `npm run generate:teams-packages` afterward to copy them into the seven Teams packages. The 192-pixel color and 32-pixel white-on-transparent outline PNGs are committed so package generation does not require image tooling.

The former five-agent `teams-project-manager-assistant` suite is retired. This is a breaking migration: install each replacement as a separate Microsoft 365 app and do not reuse the former suite's generated `TEAMS_APP_ID` or `MCP_DA_AUTH_ID_PDSPROJECTAI` values. The shared endpoint remains unchanged; the picker returns `{ selectionReference, fileName }`, which is passed to `create_session_from_onedrive`. Legacy callers may continue passing `{ driveId, itemId }`.

### Report generation and PDS setup

All seven Teams/M365 packages use the PDS compatibility endpoint `https://mcp.projectdata.ai/mcp/m365`, configured in each package's `source-metadata.json` and emitted into `appPackage/ai-plugin.json`. Deploy service support for this path before rolling out the updated packages. OAuth discovery and DCR target URL prefixes remain at the service origin; existing origin-scoped bindings cover the new path. Other clients can continue using the normal MCP endpoint.

The five analysis packages retain the native Code Interpreter capability for report attachments. Work IQ Word, conversion, and report-storage actions and OAuth provisioning are removed; no Work IQ tenant or auth IDs are needed for packaging. Existing ignored environment values and tenant vault registrations are unused and are not automatically deleted. Installed agents require an updated package release before the removed actions disappear. This change does not remove native M365 search, PDS project-file access, or authorized MPP commit destinations.

### Safe local package checks

Run these commands from the asset repository to regenerate and verify local package source only. They do not access a tenant or mutate Microsoft 365 resources:

```powershell
npm run generate:teams-packages
npm run check:teams-packages
npm run validate:teams-packages
```

### CI installable package artifacts

On pushes to `main` and manual workflow runs, the Build agent assets workflow builds and validates one sideloadable M365 app ZIP for each Teams agent, then uploads them as the `m365-agent-installable-packages` artifact. Pull requests continue to run source validation without requiring tenant-specific configuration. This CI step only packages and validates; it does not provision, install, share, or publish apps.

Configure these seven GitHub Actions repository or organization secrets with the complete contents of each corresponding ignored `apps/<package>/env/.env.dev` file:

- `M365_AGENT_DEV_ENV_PROJECT_MANAGER_ASSISTANT`
- `M365_AGENT_DEV_ENV_SCHEDULE_QUALITY_ANALYST`
- `M365_AGENT_DEV_ENV_PORTFOLIO_EXECUTIVE_ANALYST`
- `M365_AGENT_DEV_ENV_RESOURCE_MANAGER`
- `M365_AGENT_DEV_ENV_MPP_DATA_AUDITOR`
- `M365_AGENT_DEV_ENV_PROJECT_PLAN_EDITOR`
- `M365_AGENT_DEV_ENV_PROJECT_SCHEDULE_GENERATOR`

Each file must contain that package's provisioned dev app ID and PDS auth configuration ID. No Work IQ auth configuration is needed. Keep the values package-specific; the resulting ZIPs are bound to the configured dev tenant.

### Build and download the CI artifacts

To build on demand, open the repository's **Actions** tab, select **Build agent assets**, choose **Run workflow**, select the branch, and start the run. Pushes to `main` also build the artifacts automatically; pull requests validate the source but do not produce the M365 app ZIP artifact.

After the workflow succeeds, open that run and download **`m365-agent-installable-packages`** from its **Artifacts** section. It contains one installable app ZIP per role, named for its `teams-*` package, plus `DEPLOYMENT.md` with testing and organization rollout steps. Extract the downloaded artifact and upload individual package ZIPs, not the outer artifact archive. This artifact is separate from **`pds-project-ai-agent-packages`**, which contains the Copilot Studio agent asset bundles. Artifacts are retained for 14 days.

The downloaded M365 ZIPs are packaged for the dev tenant configured by the seven secrets above. Building the artifact does not install the apps or submit them for organization approval; use the separate development installation or organization submission steps below.

### Development provisioning and organization submission

#### Mandatory release synchronization

The repository is authoritative; Developer Portal definitions and the deployed catalog are separate copies. Updating one does not automatically synchronize the other.

1. Prepare the release version(s); bumping all agents together is allowed. Build and validate each release ZIP once. Record the app ID, version, source commit (and any uncommitted changes), and SHA-256 checksum.
2. Update the existing Developer Portal app definition from that exact ZIP, preserving the app ID. Use the lifecycle's `teamsApp/update` step or import the ZIP in Developer Portal. Stop if synchronization fails.
3. Publish the same ZIP to the tenant catalog, or submit the appropriate production ZIP through Partner Center. A direct Teams admin center upload is a publication fallback, not a replacement for step 2.
4. Read back the app ID and version from Developer Portal and the target catalog. Do not mark a release complete until both match the intended release. Marketplace submission or approval pending means the release is still pending.
5. Retry only the failed stage with the same ZIP and version. Do not rerun a coordinator that automatically bumps or regenerates packages for a retry; never use an outdated portal export as a release artifact.

For the current dev rollout, synchronize and publish only Project Manager, Data Auditor, Plan Editor, and Schedule Generator unless the user explicitly expands scope. An all-agent version bump does not change publication scope. Do not replace existing app IDs or delete legacy duplicate definitions without explicit approval.

This is a mandatory release procedure, not an automated gate in the current coordinator. A successful catalog upload alone is not evidence of a completed release.

Run from this asset repository in PowerShell, signed in to Microsoft 365 Agents Toolkit for a **non-production tenant**. Custom app upload must be enabled and the account must have permission to create and submit apps. Keep each package's ignored `env/.env.dev` local with `TEAMSFX_ENV=dev` and `APP_NAME_SUFFIX=dev`; Toolkit writes that package's `TEAMS_APP_ID`, `M365_APP_ID`, and `MCP_DA_AUTH_ID_*` during provisioning. Never copy generated IDs between packages or commit local env files. Do not clear existing IDs when retrying a partially successful run.

The Microsoft 365 title service requires every extension to use a manifest version higher than the existing title. An executed `publish` or `all` run automatically increments the patch version in every package's canonical `source-metadata.json` and regenerates the package manifests and package metadata before invoking Toolkit. Use `npm run bump:teams-package-versions` followed by `npm run generate:teams-packages` when preparing a version outside the coordinator. Keep the existing package-local IDs; provisioning updates the existing Teams app and acquires the higher-version title.

The coordinator targets only `--env dev`. Without `--execute` it prints the planned work and does not contact the tenant. With `--execute` it runs each package sequentially and stops at the first Toolkit failure; it does not roll back packages that already succeeded.

```powershell
npm run generate:teams-packages
npm test
npm run manage:teams-packages -- all --env dev
npm run manage:teams-packages -- provision --env dev --execute
# After provisioning, install the seven dev agents for your signed-in account:
npm run manage:teams-packages -- install --env dev
npm run manage:teams-packages -- install --env dev --execute
# Only after testing all seven agents and approving submission for admin review:
npm run manage:teams-packages -- publish --env dev
npm run manage:teams-packages -- publish --env dev --execute
```

`provision` creates or updates seven separate dev Teams apps and PDS DCR configurations and extends each app to Microsoft 365. `install` then builds, validates, and sideloads each dev ZIP in **Personal** scope for the signed-in account; it does not install for other tenant users. It requires successful provisioning and package-local generated IDs first. Toolkit's `install --scope Shared` is also **not** a tenant-wide install. Test every agent in Copilot, including per-user PDS sign-in and MPP selection. Verify downloadable report generation only on the five analysis agents, manual saving, no Work IQ prompts, and no project-data changes. Verify the two write agents execute clear requests and ask only for genuinely missing or ambiguous inputs. `all` still means **provision and publish**, not install or share.

For managed rollout or automatic installation for selected users, use `publish`: it rebuilds and validates each package, then submits it to the Teams admin center for organization review. It does **not** make agents available to everyone: an administrator must approve each submission, choose the audience, and optionally preinstall them. Check **Teams admin center > Teams apps > Manage apps** for any previously submitted app by its Teams app ID before running the seven-package batch; a successful `atk publish` may already have submitted one package even if its local `TEAMS_APP_PUBLISHED_APP_ID` is absent. If one has already been submitted, run `atk publish --env dev --interactive false` only from each remaining package directory after testing it. `all --env dev --execute` runs provisioning **and submission** in one go; avoid it when a human testing gate is required between those stages. None of these modes deploys the PDS API or publishes to the public Microsoft Store.

The optional `share-tenant` coordinator calls Toolkit `share --scope tenant` on each title; it does **not** submit an app for admin review or preinstall it. In this dev tenant, Toolkit's title-service `POST /allowed` returned HTTP 403 (`Title ... is not allowed to be modify`) for both tenant-wide and single-user shares of fresh titles. The batch stops on the first denial, leaving later packages untouched. Do not keep retrying, reset generated IDs, or treat this command as the default distribution path. The cause of the title-service denial is unconfirmed; use the separate `publish` and administrator approval workflow for distribution. A dry run of `share-tenant` checks command syntax only, not permission to share.

If a batch stops, inspect the failed package's Toolkit output and local `env/.env.dev`, fix the cause, and rerun only the failed stage. Repeating a successful stage uses its existing package-local IDs; do not delete or replace them to force a retry. A partial `publish` run may already have submitted earlier packages for approval; check the Teams admin center before resubmitting. The coordinator does not run in CI.

### Public Marketplace packaging

The dev `publish` stage above submits only to your organization's catalog, not the public Teams Store or AppSource. Never submit a dev ZIP to Partner Center. The current public Marketplace packaging path is limited to the five read-only analysis packages; the commit-capable editor packages are intentionally excluded pending a separate external-tenant security review. For each Marketplace role, provision a **separate production Teams app ID** and a PDS MCP auth registration that works across customer tenants. The existing `m365agents.yml` uses `targetAudience: HomeTenant` for dev; its DCR output is not a cross-tenant production registration. Set up and verify the production registration with `AnyApp` and a cross-tenant audience through the approved deployment workflow. Do not copy any dev ID or secret into production. The PDS API/Entra registrations must support external-tenant users and combined consent before publishing.

Place the production IDs in each package's ignored `env/.env.prod`: `TEAMSFX_ENV=prod`, `APP_NAME_SUFFIX=` (empty), `TEAMS_APP_ID=<production app ID>`, and the package's `MCP_DA_AUTH_ID_*` key with its separately registered production auth ID. No Work IQ registrations are required. Run the Marketplace packaging command with Node.js 22.9 or newer (`node:util.parseEnv`); the other asset commands continue to support Node.js 20. The packaging command checks all five identities before it builds anything. It renders suffix-free production files under ignored `appPackage/build/marketplace/` and never modifies the checked-in dev templates.

```powershell
npm run package:marketplace
# Optional local template check without prod credentials or tenant calls:
npm run package:marketplace -- --prepare
# Only once separate production IDs and cross-tenant auth have been verified:
npm run package:marketplace -- --execute
```

Execution performs only local Toolkit `package` and `validate` for `prod`; it cannot provision, publish, install, share, upload, or submit apps. Confirm every ZIP under `apps/<role>/appPackage/build/appPackage.prod.zip` has the intended production identity and auth binding. Test PDS sign-in, Graph OBO, picker, pagination, and read-only boundaries with a non-admin user in an **external test tenant** before Partner Center submission. Submit production packages through the publisher's approved Marketplace workflow, with distinct role value propositions and required listing/test assets. Work IQ OneDrive/SharePoint/Word preview MCP URLs and tenant-specific authentication are not bundled into these public packages; add them only after a supported cross-tenant, read-only connection has been demonstrated. No production tenant changes are part of this packaging workflow.

## License

Released under the [MIT License](LICENSE).
