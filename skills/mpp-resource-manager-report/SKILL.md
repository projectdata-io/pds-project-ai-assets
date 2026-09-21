---
name: mpp-resource-manager-report
description: "Create a resource-management report from a Microsoft Project MPP plan through PDS Project AI. Use for staffing demand, assignment load, overallocations, availability, upcoming pressure, and resource decisions."
argument-hint: "Provide an MPP source or session ID, date range, and optional team or resource focus"
---

# MPP Resource Manager Report

## Use When

- A resource manager needs staffing demand, availability, assignment, or over-allocation information.
- The user wants operational resource decisions rather than a general capacity summary.

## Required MCP Capabilities

- Tools: `create_session_from_reference`, `create_session_from_onedrive`, `list_tasks`, `list_resources`, `list_assignments`, `list_calendars`, `close_session`.
- Scope: `Session.ReadOnly`.

## Workflow

1. Confirm the reporting window and resource scope. Reuse a supplied session or create one authorized session and track ownership.
2. Query complete resource pages with identity, state, maximum and peak units, over-allocation, availability, work, actual work, and remaining work fields.
3. Query complete assignment pages with task/resource UIDs, units, dates, work, progress, and over-allocation. Query task names, dates, criticality, and milestones for affected assignments.
4. Retrieve calendars only when working-time or availability interpretation requires them.
5. Join entities by UID. Distinguish direct over-allocation flags from agent-derived overlap or concentration observations.
6. Rank near-term concerns by source over-allocation, critical assignments, overlapping windows, remaining work, and unavailable/inactive resources.
7. Suggest questions or staffing decisions without silently recommending named replacements.
8. Close only a session created by this skill.

## Guardrails

- Do not infer daily capacity from aggregate work without timephased data.
- Do not assume the scale of assignment units or maximum units.
- Do not expose personal rates, email addresses, or account identifiers unless explicitly requested and authorized.
- Do not label low assignment count as underutilization without availability evidence.
- Cite resource, assignment, and task UIDs. Do not perform edits.

## Output Format

Return window and coverage, staffing overview, overallocated resources, upcoming demand, availability conflicts, critical-work concentration, decisions needed, and limitations.

## Error Handling

- If calendars or availability are absent, omit capacity conclusions requiring them.
- If units are ambiguous, report source values without percentages.
- Recreate an expired session only from an available authorized source.

## Compatibility

Uses the current public PDS Project AI resource, assignment, task, calendar, and session tools.