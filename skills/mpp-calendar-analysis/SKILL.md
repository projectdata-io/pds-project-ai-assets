---
name: mpp-calendar-analysis
description: "Analyze Microsoft Project calendars through PDS Project AI. Use for working time, exceptions, work weeks, base-calendar inheritance, and calendar-related schedule questions."
argument-hint: "Provide an MPP source or session ID and optional calendar, resource, task, or date range"
---

# MPP Calendar Analysis

## Use When

- The user asks about working days, working hours, holidays, exceptions, work weeks, or assigned calendars.
- The user asks whether calendar configuration may explain a schedule date.

## Required MCP Capabilities

- Tools: `create_session_from_reference`, `create_session_from_onedrive`, `get_entity_schema`, `get_project`, `list_calendars`, `list_tasks`, `list_resources`, `close_session`.
- Scope: `Session.ReadOnly`.

## Workflow

1. Reuse a supplied session or create one authorized session and track ownership.
2. Read project `calendarUid`, `minutesPerDay`, `minutesPerWeek`, and `daysPerMonth` when available.
3. Query all calendars with `shapeProfile: "full"`, `top: 1000`, `orderBy: "uid asc"`, `select: "uid,name,baseCalendarUid,resourceUid,isBaseCalendar,isBaselineCalendar"`, and `expand: "weekDays,exceptions,workWeeks"`.
4. Resolve base-calendar relationships by UID. Detect missing parents and cycles before describing inheritance.
5. Query task or resource `calendarUid` only when the user asks which entities use a calendar.
6. For a requested date range, list applicable ordinary working periods, work-week overrides, and exceptions. Do not calculate a scheduled finish unless all required calendar semantics are available.
7. Close only a session created by this skill.

## Guardrails

- Do not assume Monday through Friday or eight-hour days.
- Do not treat a named holiday as nonworking unless its exception data says so.
- Do not infer timezone information absent from the payload.
- Distinguish direct calendar data from inheritance interpretation and cite calendar UIDs.
- Do not perform edits; calendar editing is not part of this workflow.

## Output Format

Return project calendar context, calendar hierarchy, standard working pattern, exceptions and overrides, entity assignments when requested, anomalies, and interpretation limits.

## Error Handling

- If nested expansions are unavailable, report calendar identity and hierarchy without working-time conclusions.
- If a base calendar is missing or cyclic, flag it as a data-quality issue and stop inheritance traversal.
- Recreate an expired session only from an available authorized source.

## Compatibility

Uses the current public PDS Project AI calendar expansions, project settings, entity schema, and session tools.