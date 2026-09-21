---
name: mpp-constraint-review
description: "Review Microsoft Project task constraints and deadlines through PDS Project AI. Use for hard constraints, constraint dates, deadline conflicts, date restrictions, and constraint-driven schedule risk."
argument-hint: "Provide an MPP source or session ID and optional task, milestone, or date focus"
---

# MPP Constraint Review

## Use When

- The user asks which tasks are constrained, deadline-driven, or prevented from moving naturally.
- The user wants constraint and deadline exposure around milestones or project finish.

## Required MCP Capabilities

- Tools: `create_session_from_reference`, `create_session_from_onedrive`, `get_entity_schema`, `get_project`, `list_tasks`, `close_session`.
- Scope: `Session.ReadOnly`.

## Workflow

1. Reuse a supplied session or create one authorized session and track ownership.
2. Read project start, finish, and `currentDate` to establish schedule context.
3. Call `get_entity_schema` with `entityType: "tasks"` and `profile: "full"` before interpreting constraint fields.
4. Query every task page with `shapeProfile: "full"`, `top: 1000`, `orderBy: "id asc"`, and `select: "uid,id,name,wbs,summary,active,start,finish,deadline,constraintType,constraintDate,critical,totalSlack,startVariance,finishVariance,taskMode"`.
5. Identify tasks with explicit constraint or deadline data. Compare constraint dates, scheduled dates, deadlines, status date, slack, and variance only when values are present and comparable.
6. Rank review candidates by missed deadlines, negative slack, criticality, finish exposure, and restrictive constraint evidence established by the public schema.
7. Close only a session created by this skill.

## Guardrails

- Do not assign names to numeric constraint values unless the returned public schema defines the mapping.
- Do not call a constraint harmful solely because it exists.
- Do not assume manually scheduled work is invalid.
- Preserve date-time offsets and cite task UIDs.
- Do not perform edits.

## Output Format

Return assessment basis, constrained-task inventory, deadline conflicts, highest schedule exposures, manually scheduled review candidates, and interpretation limits. Show exact source values and dates.

## Error Handling

- If constraint semantics cannot be resolved, report stored values without classifying them as hard or soft.
- If dates are missing or incompatible, omit comparisons rather than inventing results.
- Recreate an expired session only from an available authorized source.

## Compatibility

Uses the current public PDS Project AI project context, full task constraint fields, schema discovery, and session tools.