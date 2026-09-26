# PDS Project AI Assets

Public, reusable agent assets for working with Microsoft Project MPP files through the PDS Project AI MCP server.

## Repository layout

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

## Available agents

Each agent packages role-focused instructions, an MCP tool allowlist, and mapped workflows for Copilot Studio. Standard Agents are created manually; Agents can also be deployed from a generated `BotDefinition` template.

| Agent | What it does | Standard Agent | Agent |
| --- | --- | --- | --- |
| Project Manager Assistant | Status, milestones, lookahead, dependencies, and near-term attention. | Yes | Yes |
| Schedule Quality Analyst | Schedule logic, constraints, realism, and data-quality assurance. | Yes | Yes |
| Resource Manager | Resource demand, capacity, and assignment reporting. | No | Yes |
| Portfolio and Executive Analyst | Executive status, master-project rollup, and variance reporting. | Yes | Yes |
| Project Plan Editor | Guarded MPP edits: draft, preview, validate, confirm, commit. | No | Yes |
| Project Schedule Generator | Generate new project schedules through guarded drafts. | No | Yes |
| MPP Data Auditor | Read-only entity, hierarchy, and custom-field assurance. | Yes | Yes |
| Portfolio List Maintainer | Keeps a SharePoint portfolio list in sync from changed MPP files. | Yes | No |
| Task List Synchronizer | Syncs MPP tasks into a SharePoint task list, including deletions. | Yes | No |
| Project Intake Triage | Profiles newly added MPP files and records a triage classification. | Yes | No |
| Change Watcher | Diffs updated MPP files against the last sync and records a change report. | Yes | No |
| Stakeholder Notifier | Derives per-audience notification entries from updated MPP files. | Yes | No |
| Compliance Gate | Evaluates plans against schedule quality gates and records the verdict. | Yes | No |
| Project Template Provisioning | Provisions new project files from approved templates, with guarded customization. | Yes | No |
| Progress Collector | Seeds SharePoint progress requests from a plan, then applies the submissions back in one confirmed batch. | Yes | No |
| Cross-Project Dependency Checker | Keeps a shared dependency register and reports broken cross-project links. | Yes | No |
| Deliverable Link Checker | Keeps a shared deliverable-key register and reports broken soft cross-project links. | Yes | No |

Agent sources live under [`agents/copilot-studio/`](agents/copilot-studio/). See [Apply Generated Assets in Copilot Studio](agents/copilot-studio/README.md) for setup, and the [available workflow specifications](#available-workflow-specifications) below for the skills each agent can run.

## Available workflow specifications

These `SKILL.md` files are reusable workflow specifications. Copilot Studio agents using the standard harness do not import them as native skills, topics, or tools.

| Skill | Purpose |
| --- | --- |
| [`mpp-project-summary`](skills/mpp-project-summary/SKILL.md) | Summarize project dates, progress, milestones, effort, cost, and key concerns. |
| [`mpp-schedule-health`](skills/mpp-schedule-health/SKILL.md) | Assess overdue work, stale progress, constraints, deadlines, slack, and status consistency. |
| [`mpp-critical-path-analysis`](skills/mpp-critical-path-analysis/SKILL.md) | Analyze critical tasks, slack, predecessor chains, and finish drivers. |
| [`mpp-resource-capacity`](skills/mpp-resource-capacity/SKILL.md) | Review overallocations, assignment load, availability, and workload concentration. |
| [`mpp-executive-status-report`](skills/mpp-executive-status-report/SKILL.md) | Produce an evidence-based sponsor or steering status report. |
| [`mpp-safe-commit`](skills/mpp-safe-commit/SKILL.md) | Stage, preview, validate, confirm, and commit explicitly requested MPP edits. |
| [`mpp-milestone-review`](skills/mpp-milestone-review/SKILL.md) | Review upcoming, missed, completed, and dependency-exposed milestones. |
| [`mpp-baseline-variance`](skills/mpp-baseline-variance/SKILL.md) | Compare current schedule, work, and cost values with saved baselines. |
| [`mpp-earned-value-analysis`](skills/mpp-earned-value-analysis/SKILL.md) | Analyze stored and calculated earned-value performance measures. |
| [`mpp-progress-audit`](skills/mpp-progress-audit/SKILL.md) | Find contradictory, incomplete, and stale project status data. |
| [`mpp-cost-review`](skills/mpp-cost-review/SKILL.md) | Review current, actual, remaining, baseline, fixed, and overtime costs. |
| [`mpp-calendar-analysis`](skills/mpp-calendar-analysis/SKILL.md) | Explain working time, exceptions, work weeks, and calendar inheritance. |
| [`mpp-wbs-analysis`](skills/mpp-wbs-analysis/SKILL.md) | Analyze hierarchy, work packages, rollups, and outline anomalies. |
| [`mpp-master-project-navigation`](skills/mpp-master-project-navigation/SKILL.md) | Navigate read-only master-project graphs and child project data. |
| [`mpp-data-quality-audit`](skills/mpp-data-quality-audit/SKILL.md) | Audit identifiers, relationships, dates, hierarchy, and planning completeness. |
| [`mpp-custom-field-analysis`](skills/mpp-custom-field-analysis/SKILL.md) | Discover and analyze custom fields, aliases, and extended attributes. |
| [`mpp-lookahead-report`](skills/mpp-lookahead-report/SKILL.md) | Report upcoming work, milestones, handoffs, and near-term resource demand. |
| [`mpp-plan-comparison`](skills/mpp-plan-comparison/SKILL.md) | Compare two plans while preserving identity and match confidence. |
| [`mpp-change-impact-report`](skills/mpp-change-impact-report/SKILL.md) | Explain previewed draft effects and validation status before commit. |
| [`mpp-create-project`](skills/mpp-create-project/SKILL.md) | Create and validate a new project draft from explicit requirements. |
| [`mpp-progress-editor`](skills/mpp-progress-editor/SKILL.md) | Stage and validate explicit task progress updates. |
| [`mpp-schedule-editor`](skills/mpp-schedule-editor/SKILL.md) | Stage and validate task, hierarchy, duration, and dependency edits. |
| [`mpp-resource-editor`](skills/mpp-resource-editor/SKILL.md) | Stage and validate resource and assignment edits. |
| [`mpp-draft-repair`](skills/mpp-draft-repair/SKILL.md) | Repair structured draft validation issues without committing. |
| [`mpp-dependency-audit`](skills/mpp-dependency-audit/SKILL.md) | Audit dependency completeness, integrity, cycles, lag, and handoffs. |
| [`mpp-constraint-review`](skills/mpp-constraint-review/SKILL.md) | Review constraints, deadlines, date restrictions, and schedule exposure. |
| [`mpp-project-manager-brief`](skills/mpp-project-manager-brief/SKILL.md) | Produce an operational briefing for near-term project delivery. |
| [`mpp-resource-manager-report`](skills/mpp-resource-manager-report/SKILL.md) | Report staffing demand, availability, assignment load, and decisions. |
| [`mpp-portfolio-rollup`](skills/mpp-portfolio-rollup/SKILL.md) | Roll up resolved master-project nodes without double-counting. |
| [`mpp-portfolio-list-maintenance`](skills/mpp-portfolio-list-maintenance/SKILL.md) | Build a deterministic portfolio-list payload from a created or updated MPP file. |
| [`mpp-task-list-sync`](skills/mpp-task-list-sync/SKILL.md) | Synchronize an MPP task schedule into a configured SharePoint task list. |
| [`mpp-project-intake-triage`](skills/mpp-project-intake-triage/SKILL.md) | Profile a newly added MPP file and record a rule-based triage classification. |
| [`mpp-change-watch-report`](skills/mpp-change-watch-report/SKILL.md) | Diff an updated MPP file against its task-list snapshot and record a change report. |
| [`mpp-stakeholder-notification`](skills/mpp-stakeholder-notification/SKILL.md) | Derive per-audience notification entries from an updated MPP file. |
| [`mpp-compliance-gate-check`](skills/mpp-compliance-gate-check/SKILL.md) | Evaluate an updated MPP file against schedule quality gates and record the verdict. |
| [`mpp-project-template-provisioning`](skills/mpp-project-template-provisioning/SKILL.md) | Provision a new project file by copying an approved MPP template, then customize it through guarded drafts. |
| [`mpp-progress-collection`](skills/mpp-progress-collection/SKILL.md) | Collect team-reported progress from a SharePoint intake list and apply it to the source plan in one confirmed batch. |
| [`mpp-progress-request`](skills/mpp-progress-request/SKILL.md) | Seed a SharePoint intake list with per-resource progress request rows from a plan's active assignments. |
| [`mpp-dependency-register-publish`](skills/mpp-dependency-register-publish/SKILL.md) | Publish a plan's provided milestones and required external dependencies to a shared register. |
| [`mpp-cross-project-dependency-check`](skills/mpp-cross-project-dependency-check/SKILL.md) | Evaluate cross-project requirements against the shared dependency register and record the verdict. |
| [`mpp-deliverable-register-publish`](skills/mpp-deliverable-register-publish/SKILL.md) | Publish a plan's declared deliverable keys to a shared deliverable register, independent of native Project Server fields. |
| [`mpp-deliverable-link-check`](skills/mpp-deliverable-link-check/SKILL.md) | Evaluate declared deliverable-key links against the shared register and record the verdict. |
| [`mpp-schedule-realism-review`](skills/mpp-schedule-realism-review/SKILL.md) | Review schedule logic, modeling quality, assumptions, and realism. |

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

`apps/` contains five independently deployable `ProjectData AI Essentials` packages:

- `teams-project-manager-assistant`
- `teams-schedule-quality-analyst`
- `teams-portfolio-executive-analyst`
- `teams-resource-manager`
- `teams-mpp-data-auditor`

Every package has exactly one `copilotAgents.declarativeAgents` manifest entry, one package-local `m365agents.yml` lifecycle, a unique `MCP_DA_AUTH_ID_*` DCR binding, role-specific generated instructions, and a minimal read-only PDS MCP allowlist. All five retain the shared User UI icon's white mark with distinct role badges, and reuse the PDS MCP endpoint and metadata-only project-plan picker. They do not contain write agents, write skills, or write tools.

On Windows, run `./scripts/build-teams-icons.ps1` to render the canonical role icon pairs in `shared/agent-icons/` from the original `shared/user-ui-icons/` artwork. Run `npm run generate:teams-packages` afterward to copy them into the five Teams packages. The 192-pixel color and 32-pixel white-on-transparent outline PNGs are committed so package generation does not require image tooling.

The former five-agent `teams-project-manager-assistant` suite is retired. This is a breaking migration: install each replacement as a separate Microsoft 365 app and do not reuse the former suite's generated `TEAMS_APP_ID` or `MCP_DA_AUTH_ID_PDSPROJECTAI` values. The shared endpoint and picker result `{ driveId, itemId, fileName }` remain unchanged.

### Safe local package checks

Run these commands from the asset repository to regenerate and verify local package source only. They do not access a tenant or mutate Microsoft 365 resources:

```powershell
npm run generate:teams-packages
npm run check:teams-packages
npm run validate:teams-packages
```

### Development provisioning and organization submission

Run from this asset repository in PowerShell, signed in to Microsoft 365 Agents Toolkit for a **non-production tenant**. Custom app upload must be enabled and the account must have permission to create and submit apps. Keep each package's ignored `env/.env.dev` local with `TEAMSFX_ENV=dev` and `APP_NAME_SUFFIX=dev`; Toolkit writes that package's `TEAMS_APP_ID`, `M365_APP_ID`, and `MCP_DA_AUTH_ID_*` during provisioning. Never copy generated IDs between packages or commit local env files. Do not clear existing IDs when retrying a partially successful run.

The coordinator targets only `--env dev`. Without `--execute` it prints the planned work and does not contact the tenant. With `--execute` it runs each package sequentially and stops at the first Toolkit failure; it does not roll back packages that already succeeded.

```powershell
npm run generate:teams-packages
npm test
npm run manage:teams-packages -- all --env dev
npm run manage:teams-packages -- provision --env dev --execute
# After provisioning, install the five dev agents for your signed-in account:
npm run manage:teams-packages -- install --env dev
npm run manage:teams-packages -- install --env dev --execute
# To make the five provisioned dev agents available across the tenant:
npm run manage:teams-packages -- share-tenant --env dev
npm run manage:teams-packages -- share-tenant --env dev --execute
# Only after testing all five agents and approving submission for admin review:
npm run manage:teams-packages -- publish --env dev --execute
```

`provision` creates or updates five separate dev Teams apps and DCR configurations and extends each to Microsoft 365. `install` then builds, validates, and sideloads each dev ZIP in **Personal** scope for the signed-in account; it does not install for other tenant users. It requires successful provisioning and package-local generated IDs first. Toolkit's `install --scope Shared` is also **not** a tenant-wide install. `share-tenant` grants access to the five provisioned agents across the tenant, but does not preinstall them. Both modes require `--execute` to change tenant state. `all` still means **provision and publish**, not install or share. Test every agent in Copilot, including per-user PDS sign-in, MPP selection, and read-only behavior, before sharing or publishing. For a small test group, run Toolkit's `share --env dev --scope users --email 'person@tenant.example' -i false` from each package directory instead.

For managed rollout or automatic installation for selected users, use `publish`: it rebuilds and validates each package, then submits it to the Teams admin center for organization review. It does **not** make agents available to everyone: an administrator must approve each submission, choose the audience, and optionally preinstall them. `all --env dev --execute` runs provisioning **and submission** in one go; avoid it when a human testing gate is required between those stages. None of these modes deploys the PDS API or publishes to the public Microsoft Store.

If a batch stops, inspect the failed package's Toolkit output and local `env/.env.dev`, fix the cause, and rerun only the failed stage. Repeating a successful stage uses its existing package-local IDs; do not delete or replace them to force a retry. A partial `publish` run may already have submitted earlier packages for approval; check the Teams admin center before resubmitting. The coordinator does not run in CI.

## License

Released under the [MIT License](LICENSE).