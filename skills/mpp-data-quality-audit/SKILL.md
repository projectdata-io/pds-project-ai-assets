---
name: mpp-data-quality-audit
description: "Audit Microsoft Project MPP data quality through PDS Project AI. Use for missing identifiers, broken relationships, invalid dates, duplicate values, orphan assignments, and incomplete planning data."
argument-hint: "Provide an MPP source or session ID and optional audit scope"
---

# MPP Data Quality Audit

## Use When

- The user asks whether an MPP plan is complete, consistent, or ready for reporting and automation.
- The user wants broken task, resource, assignment, calendar, or dependency references identified.

## Required MCP Capabilities

- Tools: `create_session_from_reference`, `create_session_from_onedrive`, `get_project`, `list_tasks`, `list_resources`, `list_assignments`, `list_calendars`, `list_attributes`, `close_session`.
- Scope: `Session.ReadOnly`.

## Workflow

1. Reuse a supplied session or create one authorized session and track ownership.
2. Retrieve complete, bounded pages for tasks, resources, assignments, calendars, and attributes. Select stable UIDs, relationship UIDs, names, hierarchy fields, dates, and state flags.
3. Check uniqueness of entity UIDs and report duplicate names only as ambiguity, not identity failure.
4. Verify assignment `taskUid` and `resourceUid`, task `parentTaskUid`, task/calendar references, and predecessor references against retrieved entities.
5. Check date ordering, hierarchy cycles, impossible state combinations, inactive/null references, and missing names or required identifiers.
6. Separate contract violations, definite inconsistencies, and advisory completeness findings.
7. Close only a session created by this skill.

## Guardrails

- Do not label optional blank fields as errors.
- Check complete pagination before declaring a relationship orphaned.
- Do not infer identity from names. Cite entity type and UID.
- Do not perform repairs or edits.

## Output Format

Return coverage, severity-ranked findings, affected UIDs, exact conflicting fields, relationship integrity, advisory gaps, and audit limitations.

## Error Handling

- If a collection cannot be retrieved, mark dependent checks as not run.
- If a referenced UID is absent, confirm pagination before reporting it as unresolved.
- Recreate expired sessions only from an available authorized source.

## Compatibility

Uses the current public PDS Project AI entity collections, relationships, and session tools.