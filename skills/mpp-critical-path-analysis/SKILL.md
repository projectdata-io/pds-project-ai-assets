---
name: mpp-critical-path-analysis
description: "Analyze critical tasks, slack, and predecessor relationships in a Microsoft Project MPP plan through PDS Project AI. Use for critical path, dependency chain, and finish-driver questions."
argument-hint: "Provide an MPP source or session ID and optional task or milestone focus"
---

# MPP Critical Path Analysis

## Use When

- The user asks for critical tasks, the critical path, finish drivers, dependency bottlenecks, or near-critical work.
- The user asks why a milestone or project finish is exposed to delay.

## Do Not Use When

- The user wants broad schedule health without dependency analysis.
- The user asks to add, remove, or change links; this skill is read-only.

## Required MCP Capabilities

- Tools: `create_session_from_reference`, `create_session_from_onedrive`, `get_project`, `list_tasks`, `close_session`.
- Scope: `Session.ReadOnly`.

## Workflow

1. Reuse a supplied session or create one authorized session and track ownership.
2. Read the project start and finish with `get_project`.
3. Call `list_tasks` with `shapeProfile: "full"`, `top: 1000`, `orderBy: "id asc"`, `select: "uid,id,name,wbs,summary,active,milestone,start,finish,critical,freeSlack,totalSlack,deadline,constraintType,constraintDate"`, and `expand: "predecessors"`.
4. Retrieve all pages before constructing the dependency graph. Key graph nodes by task `uid`, not row `id` or task name.
5. Build directed edges from each predecessor's `predecessorTaskUid` to `successorTaskUid`. Preserve relation type and lag as returned.
6. Report parser-marked critical tasks directly. Use numeric slack to identify near-critical candidates only when the user provides a threshold; otherwise present the lowest non-negative slack values without labeling them near-critical.
7. Trace dependency chains that lead to the requested milestone or project finish. If links are missing, circular, external, or cross-project, state that a complete continuous path cannot be proven.
8. Close only a session created by this skill.

## Guardrails

- Do not claim that all tasks with `critical: true` form one continuous path.
- Do not invent missing predecessor links or infer them from adjacent dates.
- Do not convert lag or slack units unless the returned schema establishes the unit.
- Distinguish parser-marked criticality from agent-derived graph observations.
- Cite each task by `uid`; include relation type and lag for cited links.
- Do not perform edits.

## Output Format

1. **Finish context**: project finish or focused milestone.
2. **Critical tasks**: ordered table with UID, task, dates, slack, and predecessor evidence.
3. **Driving chains**: dependency sequences expressed as task UID and name pairs.
4. **Lowest-slack noncritical work**: only when comparable slack is available.
5. **Risks and gaps**: constraints, deadlines, external links, missing nodes, cycles, and incomplete pagination.

## Error Handling

- If predecessor expansion is unavailable, report critical and slack evidence but do not claim a verified dependency chain.
- If graph references point to tasks outside the returned set, report unresolved UIDs and check pagination before concluding they are external.
- Recreate expired sessions only when the original source remains authorized.

## Compatibility

Uses the current public PDS Project AI task predecessor expansion and project/session tools.