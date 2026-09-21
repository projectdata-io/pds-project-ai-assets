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
- `catalog.json`: machine-readable skill, tool, access, and agent mappings.
- `generated/copilot-studio/`: deterministic, copy-ready agent bundles produced from the catalog and source assets.

This repository's top-level folders are intentionally not VS Code workspace discovery locations. Consumers should install or copy selected assets into the location required by their agent platform.

## Available skills

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
| [`mpp-schedule-realism-review`](skills/mpp-schedule-realism-review/SKILL.md) | Review schedule logic, modeling quality, assumptions, and realism. |

## Development

Requirements: Node.js 20 or newer.

```sh
npm run compile
npm test
```

See [CONTRIBUTING.md](CONTRIBUTING.md) before adding an asset.

Run `npm run compile` after changing the catalog, an agent package, or a mapped skill. Commit the generated output with its sources. `npm test` checks catalog coverage, MCP tool references, access boundaries, agent mappings, synthetic evaluation references, prohibited public artifacts, and whether generated bundles are current. Pull requests and pushes to `main` run the same validation in GitHub Actions.

## License

Released under the [MIT License](LICENSE).