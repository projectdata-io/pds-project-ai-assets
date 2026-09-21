---
name: mpp-executive-status-report
description: "Create an evidence-based executive status report from a Microsoft Project MPP plan through PDS Project AI. Use for sponsor updates, steering reports, delivery outlook, and concise decision briefs."
argument-hint: "Provide an MPP source or session ID, audience, status date, and reporting period"
---

# MPP Executive Status Report

## Use When

- The user requests a sponsor, steering committee, portfolio, or leadership status update.
- The user wants decisions and delivery implications rather than a raw project-data summary.

## Do Not Use When

- The user asks for a factual project overview without executive interpretation; use `mpp-project-summary`.
- The user requests file changes; this skill is read-only.

## Required MCP Capabilities

- Tools: `create_session_from_reference`, `create_session_from_onedrive`, `get_project`, `list_tasks`, `list_resources`, `list_assignments`, `close_session`.
- Scope: `Session.ReadOnly`.

## Workflow

1. Confirm the intended audience, reporting period, and status date. Reuse a supplied session or create one authorized session and track ownership.
2. Read project identity, start, finish, and `currentDate` with `get_project`.
3. Retrieve all task pages with `shapeProfile: "full"` and fields required for milestones, progress, deadlines, criticality, slack, variance, work, and cost. Order by task `id`.
4. Retrieve resources and assignments only when needed to substantiate capacity, effort, or cost findings. Keep all queries bounded and paginated.
5. Separate source facts from interpretations. Base delivery outlook on explicit schedule evidence such as overdue critical work, negative slack, missed milestones, finish variance, or unresolved resource over-allocation.
6. Select no more than five material issues and three decisions or interventions. Do not elevate routine task details unless they affect an outcome, commitment, or decision.
7. Use qualitative status labels only when evidence is present. If the organization has not supplied status thresholds, explain the basis instead of asserting a formal red/amber/green score.
8. Close only a session created by this skill.

## Guardrails

- Do not invent budget, forecast, benefits, dependencies, ownership, or narrative explanations absent from the plan.
- Do not equate percent complete with value delivered.
- Do not aggregate summary and child tasks together when calculating work or cost.
- Name the status date used and disclose stale or missing status data.
- Keep task-level evidence traceable through task `uid`; identify resources by resource `uid`.
- Do not perform edits.

## Output Format

1. **Executive summary**: three to five sentences covering delivery outlook and the most consequential evidence.
2. **Key indicators**: scheduled finish, status date, milestone outlook, critical exposure, and resource/cost indicators when supported.
3. **Achievements**: completed milestones or material progress during the reporting period when dates prove it.
4. **Risks and issues**: ranked table with impact, evidence, and entity UIDs.
5. **Decisions required**: concise decision, reason, and required-by date only when supported or supplied.
6. **Next period**: upcoming milestones and critical activities inside the requested reporting window.
7. **Data confidence**: coverage, omissions, stale data, and assumptions.

## Error Handling

- If reporting-period history cannot be established, omit achievements rather than treating all completed work as recent.
- If cost, baseline, or resource data is absent, omit that indicator and state the limitation.
- Recreate expired sessions only when the original authorized source is still available.

## Compatibility

Uses the current public PDS Project AI project, task, resource, assignment, schema, session-creation, and cleanup tools.