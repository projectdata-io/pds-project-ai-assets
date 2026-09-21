---
name: mpp-lookahead-report
description: "Create a time-bounded Microsoft Project lookahead report through PDS Project AI. Use for upcoming tasks, milestones, handoffs, critical work, and near-term resource demand."
argument-hint: "Provide an MPP source or session ID, start date, and lookahead duration"
---

# MPP Lookahead Report

## Use When

- The user requests a two-week, four-week, six-week, or custom planning lookahead.
- A delivery team needs upcoming starts, finishes, milestones, and dependencies.

## Required MCP Capabilities

- Tools: `create_session_from_reference`, `create_session_from_onedrive`, `get_project`, `list_tasks`, `list_assignments`, `list_resources`, `close_session`.
- Scope: `Session.ReadOnly`.

## Workflow

1. Confirm inclusive window start and end. Reuse a supplied session or create one authorized session and track ownership.
2. Query complete task pages for active non-summary work overlapping the window. Select UID, name, WBS, dates, progress, milestone, criticality, slack, deadline, and predecessor data.
3. Include tasks that start, finish, or remain in progress during the window. Keep overdue incomplete tasks in a separate carryover section.
4. Retrieve assignment and resource details only when near-term ownership or demand is requested.
5. Order by scheduled start, finish, then task ID. Identify handoffs using explicit predecessor relationships only.
6. Close only a session created by this skill.

## Guardrails

- Preserve date-time offsets and state window boundaries.
- Do not infer owners from task names or notes.
- Do not claim dependency readiness without predecessor status evidence.
- Cite task and resource UIDs. Do not perform edits.

## Output Format

Return window basis, overdue carryover, starts, finishes, milestones, critical handoffs, resource demand when requested, and data limitations.

## Error Handling

- If server-side date filtering is rejected, retrieve bounded pages and apply the stated overlap rule locally.
- If assignments are absent, omit ownership rather than guessing.
- Recreate expired sessions only from an available authorized source.

## Compatibility

Uses the current public PDS Project AI task, predecessor, assignment, resource, and session tools.