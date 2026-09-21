---
name: mpp-cost-review
description: "Review planned, actual, remaining, fixed, overtime, baseline, and resource costs in a Microsoft Project MPP plan through PDS Project AI. Use for project cost exposure and cost-driver analysis."
argument-hint: "Provide an MPP source or session ID and the requested cost scope"
---

# MPP Cost Review

## Use When

- The user asks about project costs, actual versus remaining cost, cost variance, overtime, fixed cost, or expensive work.
- The user wants cost drivers by task, resource, or assignment.

## Required MCP Capabilities

- Tools: `create_session_from_reference`, `create_session_from_onedrive`, `get_entity_schema`, `get_project`, `list_tasks`, `list_resources`, `list_assignments`, `close_session`.
- Scope: `Session.ReadOnly`.

## Workflow

1. Reuse a supplied session or create one authorized session and track ownership.
2. Read project `currencyCode` and status context.
3. Query the requested entity collections with `shapeProfile: "full"`, complete pagination, and stable UIDs. Select current, actual, remaining, fixed, overtime, baseline, budget, and variance cost fields supported by `get_entity_schema`.
4. Prefer project or source rollups when present. If calculating totals, include only compatible numeric values and avoid combining summary tasks with descendants.
5. Separate planned/current cost, actual cost, remaining cost, baseline cost, budget cost, overtime cost, and variance. Do not merge these concepts into one number.
6. Rank cost drivers and adverse variances with source evidence. State whether each value is stored or calculated.
7. Close only a session created by this skill.

## Guardrails

- Never assume missing cost values are zero.
- Never combine different currencies.
- Do not infer forecast-at-completion from actual plus remaining unless the user requests that formula and both values are compatible.
- Do not expose personal rate information unless the user explicitly requests it and is authorized to receive it.
- Cite entity type and UID. Do not perform edits.

## Output Format

Return currency and coverage, cost overview, largest task/resource/assignment drivers, variance and overtime concerns, calculation notes, and missing-data limitations.

## Error Handling

- If currency is missing, label monetary values as currency unspecified.
- If cost values are nonnumeric or incompatible, report source values without aggregation.
- Recreate an expired session only from an available authorized source.

## Compatibility

Uses the current public PDS Project AI full-profile cost fields, schema discovery, and project/session tools.