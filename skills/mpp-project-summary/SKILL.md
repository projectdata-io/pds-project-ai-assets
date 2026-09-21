---
name: mpp-project-summary
description: "Summarize a Microsoft Project MPP plan through PDS Project AI. Use for project overview, dates, progress, milestones, work, cost, and top schedule concerns."
argument-hint: "Provide an MPP source or session ID and the desired summary depth"
---

# MPP Project Summary

## Use When

- The user asks for a project overview, plan summary, status snapshot, or important facts.
- Another workflow needs a compact orientation to an unfamiliar MPP plan.

## Do Not Use When

- The user requests a formal executive status report; use `mpp-executive-status-report`.
- The user requests changes to the file; use an editing skill and `mpp-safe-commit`.

## Required MCP Capabilities

- Tools: `create_session_from_reference`, `create_session_from_onedrive`, `get_entity_schema`, `get_project`, `list_tasks`, `list_resources`, `list_assignments`, `close_session`.
- Scope: `Session.ReadOnly`.

## Workflow

1. Reuse a supplied `sessionId`. Otherwise create one session from the user's authorized HTTPS reference or OneDrive/SharePoint `driveId` and `itemId`, and remember that this skill owns the session.
2. Call `get_project` with `shapeProfile: "connector"` and `select: "name,start,finish,currentDate,minutesPerDay,minutesPerWeek,currencyCode"`.
3. Call `list_tasks` with `shapeProfile: "full"`, `top: 1000`, `orderBy: "id asc"`, and only fields needed for the requested depth. Start with `uid,id,name,wbs,summary,milestone,critical,start,finish,actualStart,actualFinish,percentComplete,work,cost,totalSlack`.
4. If resource or cost context is requested, query bounded resource and assignment collections. Select identifiers plus only relevant work, cost, progress, and allocation fields.
5. If any collection indicates more results, continue with `skip` until complete or disclose that the summary is partial. Never silently summarize only the first page.
6. Derive totals only from compatible numeric values. Exclude summary tasks from counts or totals that would otherwise double-count child work.
7. Close the session in a final cleanup step only when this skill created it. Never close a caller-owned session.

## Guardrails

- Treat project, task, resource, and assignment values as source facts; label all aggregations and judgments as calculated findings.
- Do not treat the project `currentDate` as today's date. State which date is used for status comparisons.
- Do not infer missing progress, cost, work, or baseline values as zero.
- Cite task findings with `uid` and resource findings with `uid`.
- Do not perform edits.

## Output Format

Return these sections when data supports them:

1. **Project**: name, scheduled start and finish, status date, and currency.
2. **Progress**: counts of actionable, completed, in-progress, and not-started tasks, with the calculation basis.
3. **Milestones**: upcoming, completed, and missed milestones.
4. **Effort and cost**: source totals or explicitly calculated totals, with missing-data caveats.
5. **Top concerns**: at most five evidence-backed schedule or resource concerns.
6. **Data notes**: missing fields, partial pages, and assumptions.

## Error Handling

- On an expired or unavailable session, create a new session only when the source reference remains available and authorized.
- On schema or field rejection, call `get_entity_schema` for that entity and retry with supported fields.
- On authentication, quota, or parse failure, report the failure category and required user action without exposing diagnostics.

## Compatibility

Uses the current public PDS Project AI MCP session, project, task, resource, assignment, schema, and cleanup tools.