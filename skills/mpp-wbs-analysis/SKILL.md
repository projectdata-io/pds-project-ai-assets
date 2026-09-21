---
name: mpp-wbs-analysis
description: "Analyze the work breakdown structure of a Microsoft Project MPP plan through PDS Project AI. Use for hierarchy summaries, work packages, orphan tasks, outline anomalies, and scope structure."
argument-hint: "Provide an MPP source or session ID and optional WBS branch or depth"
---

# MPP WBS Analysis

## Use When

- The user asks for the task hierarchy, WBS, phases, work packages, or scope breakdown.
- The user wants structural anomalies such as missing parents or inconsistent outline levels.

## Required MCP Capabilities

- Tools: `create_session_from_reference`, `create_session_from_onedrive`, `list_tasks`, `close_session`.
- Scope: `Session.ReadOnly`.

## Workflow

1. Reuse a supplied session or create one authorized session and track ownership.
2. Query every task page with `shapeProfile: "full"`, `top: 1000`, `orderBy: "id asc"`, and `select: "uid,id,name,wbs,outlineLevel,outlineNumber,parentTaskUid,summary,active,milestone,start,finish,work,cost"`.
3. Build hierarchy primarily from `parentTaskUid`. Use outline fields to order and cross-check, not to overwrite explicit parent relationships.
4. Detect unresolved parents, self-parenting, cycles, duplicate outline numbers, outline-level jumps, summary tasks without children, and leaf tasks marked as summaries.
5. Summarize only the requested depth. When rolling up work or cost, use either source summary values or leaf aggregation, never both.
6. Preserve file order for siblings unless the user requests another ordering.
7. Close only a session created by this skill.

## Guardrails

- Key tasks by `uid`, not name, row `id`, WBS, or outline number.
- Do not infer a missing parent solely from task-name wording.
- Do not treat inactive tasks as absent from scope; label their state.
- Distinguish source hierarchy from repaired or suggested hierarchy.
- Do not perform edits.

## Output Format

Return a compact hierarchy or phase summary, requested branch details, structural anomalies with UIDs, rollup basis, and data limitations. Avoid printing the entire tree when a concise level summary satisfies the request.

## Error Handling

- If parent fields are unavailable, reconstruct only a tentative hierarchy from outline fields and label it as inferred.
- If cycles occur, report involved UIDs and stop traversing that branch.
- Recreate an expired session only from an available authorized source.

## Compatibility

Uses the current public PDS Project AI full task hierarchy fields and session tools.