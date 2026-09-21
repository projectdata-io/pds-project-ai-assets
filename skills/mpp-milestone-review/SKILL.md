---
name: mpp-milestone-review
description: "Review milestones in a Microsoft Project MPP plan through PDS Project AI. Use for upcoming milestones, missed commitments, completed gates, and milestone dependency exposure."
argument-hint: "Provide an MPP source or session ID, status date, and optional lookahead window"
---

# MPP Milestone Review

## Use When

- The user asks which milestones are upcoming, late, completed, missed, or at risk.
- The user needs a milestone register or stage-gate review.

## Required MCP Capabilities

- Tools: `create_session_from_reference`, `create_session_from_onedrive`, `get_project`, `list_tasks`, `close_session`.
- Scope: `Session.ReadOnly`.

## Workflow

1. Reuse a supplied session or create one authorized session and track ownership.
2. Establish the status date from the user, project `currentDate`, or the current calendar date in that order. State the selected basis.
3. Query all task pages with `shapeProfile: "full"`, `top: 1000`, `orderBy: "finish asc"`, `filter: "milestone eq true"`, `select: "uid,id,name,wbs,active,milestone,start,finish,actualFinish,percentComplete,deadline,critical,totalSlack"`, and `expand: "predecessors"` when dependency exposure is requested.
4. Classify milestones as completed, missed, upcoming inside the requested window, or later. Treat a milestone as completed only when source completion evidence supports it.
5. Rank open milestones by missed date, criticality, negative slack, deadline pressure, and unresolved predecessor exposure.
6. Close only a session created by this skill.

## Guardrails

- Do not treat every zero-duration task as a milestone unless the source marks it as one.
- Do not infer a forecast date that is absent from the plan.
- Preserve date-time offsets and identify every milestone by task `uid`.
- Do not perform edits.

## Output Format

Return the status-date basis, milestone counts, a dated milestone table, dependency concerns, and data limitations. Include UID, name, finish, deadline, completion evidence, criticality, and slack when available.

## Error Handling

- If milestone filtering is rejected, retrieve a bounded task set and filter only the returned `milestone` field locally.
- If predecessor expansion is unavailable, omit dependency conclusions.
- Recreate an expired session only from an available authorized source.

## Compatibility

Uses the current public PDS Project AI project, task, predecessor, session-creation, and cleanup tools.