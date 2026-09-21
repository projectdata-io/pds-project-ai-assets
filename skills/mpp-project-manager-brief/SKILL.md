---
name: mpp-project-manager-brief
description: "Create an operational project-manager briefing from a Microsoft Project MPP plan through PDS Project AI. Use for weekly delivery reviews, overdue actions, lookahead, milestones, dependencies, and resource attention."
argument-hint: "Provide an MPP source or session ID, status date, and briefing period"
---

# MPP Project Manager Brief

## Use When

- A project manager needs a weekly or daily operational briefing.
- The user wants actionable task-level attention rather than an executive summary.

## Required MCP Capabilities

- Tools: `create_session_from_reference`, `create_session_from_onedrive`, `get_project`, `list_tasks`, `list_resources`, `list_assignments`, `close_session`.
- Scope: `Session.ReadOnly`.

## Workflow

1. Confirm the status date and briefing window. Reuse a supplied session or create one authorized session and track ownership.
2. Read project identity, dates, and `currentDate`.
3. Query all active task pages with fields for UID, WBS, hierarchy, dates, actuals, completion, remaining duration/work, milestone, criticality, slack, deadline, constraints, and predecessors.
4. Classify overdue incomplete work, upcoming starts and finishes, milestones, blocked handoffs, critical work, and inconsistent progress using explicit evidence.
5. Retrieve resources and assignments only to substantiate ownership, workload, or over-allocation concerns. Join by UIDs.
6. Prioritize actions by demonstrated near-term delivery impact. Keep observations separate from recommended follow-up.
7. Close only a session created by this skill.

## Guardrails

- Do not invent task owners, decisions, explanations, or recovery dates.
- Do not treat project `currentDate` as today's date without stating the basis.
- Do not create a formal status color or score without supplied thresholds.
- Cite task, resource, and assignment UIDs. Do not perform edits.

## Output Format

Return delivery snapshot, overdue actions, current critical work, upcoming window, milestone and dependency attention, resource concerns, decisions or clarifications needed, and data-quality notes.

## Error Handling

- If assignments are absent, omit ownership rather than guessing.
- If predecessor data is unavailable, omit blocked-handoff claims.
- Recreate an expired session only from an available authorized source.

## Compatibility

Uses the current public PDS Project AI project, task, predecessor, resource, assignment, and session tools.