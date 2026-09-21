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

This repository is also consumed as a submodule by the PDS Project AI product repository. Its top-level folders are intentionally not VS Code workspace discovery locations. Consumers should install or copy selected assets into the location required by their agent platform.

## Available skills

| Skill | Purpose |
| --- | --- |
| [`mpp-project-summary`](skills/mpp-project-summary/SKILL.md) | Summarize project dates, progress, milestones, effort, cost, and key concerns. |
| [`mpp-schedule-health`](skills/mpp-schedule-health/SKILL.md) | Assess overdue work, stale progress, constraints, deadlines, slack, and status consistency. |
| [`mpp-critical-path-analysis`](skills/mpp-critical-path-analysis/SKILL.md) | Analyze critical tasks, slack, predecessor chains, and finish drivers. |
| [`mpp-resource-capacity`](skills/mpp-resource-capacity/SKILL.md) | Review overallocations, assignment load, availability, and workload concentration. |
| [`mpp-executive-status-report`](skills/mpp-executive-status-report/SKILL.md) | Produce an evidence-based sponsor or steering status report. |
| [`mpp-safe-commit`](skills/mpp-safe-commit/SKILL.md) | Stage, preview, validate, confirm, and commit explicitly requested MPP edits. |

## Development

Requirements: Node.js 20 or newer.

```sh
npm test
```

See [CONTRIBUTING.md](CONTRIBUTING.md) before adding an asset.

## License

Released under the [MIT License](LICENSE).