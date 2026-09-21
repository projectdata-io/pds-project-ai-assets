---
name: mpp-schedule-realism-review
description: "Review whether a Microsoft Project schedule is structurally realistic through PDS Project AI. Use for missing logic, long tasks, excessive constraints, manual scheduling, unsupported milestones, and weak schedule design."
argument-hint: "Provide an MPP source or session ID and optional review thresholds"
---

# MPP Schedule Realism Review

## Use When

- The user asks whether a schedule is credible, robust, detailed enough, or ready for governance review.
- The user wants structural planning weaknesses rather than current delivery status alone.

## Required MCP Capabilities

- Tools: `create_session_from_reference`, `create_session_from_onedrive`, `get_project`, `list_tasks`, `list_resources`, `list_assignments`, `list_calendars`, `close_session`.
- Scope: `Session.ReadOnly`.

## Workflow

1. Ask for organizational thresholds for long tasks, acceptable lag, open ends, and constraint usage. Without them, present distributions and review candidates rather than pass/fail judgments.
2. Reuse a supplied session or create one authorized session and track ownership.
3. Query all task pages with hierarchy, schedule, duration, estimated flag, task type/mode, milestones, constraints, deadlines, slack, active state, and predecessor expansion.
4. Retrieve assignments, resources, and calendars only when testing assignment coverage, resource feasibility, or calendar assumptions.
5. Review open starts/finishes, long or estimated tasks, unsupported milestones, manual scheduling, dense hard-date usage, unusual lag, invalid hierarchy, missing assignment coverage, and calendar anomalies.
6. Separate definite integrity issues from threshold-based governance candidates and modeling preferences.
7. Rank findings by demonstrated impact on critical work, milestones, project finish, or resource feasibility.
8. Close only a session created by this skill.

## Guardrails

- Do not impose arbitrary schedule-quality thresholds.
- Do not claim an unassigned task is invalid; some work may intentionally lack named resources.
- Do not infer dependencies from dates or hierarchy.
- Do not treat all manual tasks, constraints, or lags as defects.
- Cite entity UIDs and exact evidence. Do not perform edits.

## Output Format

Return review basis and thresholds, integrity findings, logic quality, task design, milestone support, constraints/manual scheduling, assignment and calendar observations, prioritized recommendations, and limitations.

## Error Handling

- If thresholds are absent, report distributions and outliers without compliance labels.
- If predecessor, assignment, or calendar data is unavailable, mark dependent checks as not run.
- Recreate an expired session only from an available authorized source.

## Compatibility

Uses the current public PDS Project AI project, full task, predecessor, resource, assignment, calendar, and session tools.