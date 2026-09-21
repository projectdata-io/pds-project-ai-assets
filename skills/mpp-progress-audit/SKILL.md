---
name: mpp-progress-audit
description: "Audit Microsoft Project task progress data through PDS Project AI. Use for stale updates, contradictory completion fields, future actuals, incomplete past work, and status-data quality."
argument-hint: "Provide an MPP source or session ID and optional status date or staleness threshold"
---

# MPP Progress Audit

## Use When

- The user asks whether progress updates are complete, current, or internally consistent.
- The user wants tasks needing status updates before a reporting cycle.

## Required MCP Capabilities

- Tools: `create_session_from_reference`, `create_session_from_onedrive`, `get_project`, `list_tasks`, `close_session`.
- Scope: `Session.ReadOnly`.

## Workflow

1. Reuse a supplied session or create one authorized session and track ownership.
2. Establish the audit date from the user, project `currentDate`, or current calendar date in that order. Ask for a staleness threshold before labeling updates stale.
3. Query every task page with `shapeProfile: "full"`, `top: 1000`, `orderBy: "id asc"`, and `select: "uid,id,name,wbs,summary,active,start,finish,actualStart,actualFinish,percentComplete,percentWorkComplete,physicalPercentComplete,actualDuration,remainingDuration,work,actualWork,remainingWork,stop,resume"`.
4. Exclude null and summary tasks from ordinary progress counts. Check actionable tasks for contradictions such as:
   - 100% complete without completion evidence;
   - actual finish with less than 100% completion;
   - actual start after actual finish;
   - actual dates after the audit date;
   - incomplete work whose scheduled finish precedes the audit date;
   - nonzero remaining values on completed work, or absent remaining values on started work, when source fields make the comparison valid.
5. Separate definite contradictions from records that merely need review.
6. Close only a session created by this skill.

## Guardrails

- Do not infer when a record was last edited; task dates are not update timestamps.
- Do not require all three percent-complete measures to agree because they represent different concepts.
- Do not treat missing actual dates as errors without considering the task's progress state.
- Cite task UIDs and exact conflicting fields. Do not perform edits.

## Output Format

Return audit basis and coverage, definite inconsistencies, overdue incomplete tasks, threshold-based stale candidates, and records needing manual review. Include the evidence fields for every finding.

## Error Handling

- If no staleness threshold or update timestamp exists, omit stale-update claims.
- If duration/work values are not comparable, audit dates and completion fields only.
- Recreate an expired session only from an available authorized source.

## Compatibility

Uses the current public PDS Project AI full task profile and project/session tools.