---
name: mpp-schedule-health
description: "Assess Microsoft Project schedule health through PDS Project AI. Use for overdue work, stale progress, constraints, missed deadlines, negative slack, and schedule-risk reviews."
argument-hint: "Provide an MPP source or session ID and an optional status date"
---

# MPP Schedule Health

## Use When

- The user asks whether a schedule is healthy, delayed, stale, or at risk.
- The user wants overdue tasks, missed deadlines, hard constraints, or progress anomalies.

## Do Not Use When

- The user asks only for the critical path; use `mpp-critical-path-analysis`.
- The user asks to reschedule or update tasks; this skill is read-only.

## Required MCP Capabilities

- Tools: `create_session_from_reference`, `create_session_from_onedrive`, `get_entity_schema`, `get_project`, `list_tasks`, `close_session`.
- Scope: `Session.ReadOnly`.

## Workflow

1. Reuse a supplied session or create one authorized session and track ownership.
2. Read `currentDate`, `start`, and `finish` from `get_project`. Use the user-supplied status date when provided; otherwise use project `currentDate`; otherwise state that the current calendar date is being used.
3. Query tasks with `shapeProfile: "full"`, `top: 1000`, `orderBy: "id asc"`, and `select: "uid,id,name,wbs,summary,active,milestone,start,finish,actualStart,actualFinish,percentComplete,remainingDuration,deadline,constraintType,constraintDate,critical,totalSlack,startVariance,finishVariance,taskMode"`.
4. Page through the complete task set. Exclude null, inactive, and summary tasks from actionable-task counts while reporting material exceptions separately.
5. Classify evidence without inventing thresholds:
   - overdue: incomplete and scheduled finish precedes the status date;
   - missed deadline: incomplete with deadline preceding the status date, or finish later than deadline;
   - stale progress: actual start exists but progress is absent or unchanged only when the available data demonstrates that condition;
   - negative-slack risk: numeric `totalSlack` is below zero;
   - constraint risk: constraint fields are present and materially restrict dates;
   - inconsistent status: completion and actual-date fields contradict one another.
6. Rank issues by demonstrated finish impact, criticality, slack, and proximity to the status date. Do not manufacture a composite health score unless the user supplies the scoring model.
7. Close only a session created by this skill.

## Guardrails

- Preserve date-time offsets when comparing dates.
- Do not call a task late solely because it has variance; state the source baseline or comparison field.
- Do not decode numeric constraint types without a public schema mapping. Report the stored value and its date instead.
- Identify every cited task by `uid` and include its relevant source dates.
- Do not perform edits or promise that a proposed change will improve the schedule.

## Output Format

1. **Assessment basis**: source, status date, task coverage, and exclusions.
2. **Health summary**: concise evidence-based conclusion without an invented score.
3. **Highest risks**: ranked table with task UID, task, issue, dates, progress, slack, and rationale.
4. **Pattern findings**: overdue work, constraints, deadline pressure, and inconsistent status.
5. **Data limitations**: missing fields, partial results, and ambiguous units.

## Error Handling

- If the session expires, recreate it only from an available authorized source.
- If a requested field is unsupported, use `get_entity_schema` and narrow the query.
- If dates or durations cannot be compared safely, report them without classification.

## Compatibility

Uses the current public PDS Project AI project, task, schema, session-creation, and cleanup tools.