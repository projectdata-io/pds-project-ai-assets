---
name: mpp-change-watch-report
description: "Diff an updated Microsoft Project MPP file against its SharePoint task-list snapshot and record a categorized change report using the PDS Project AI MCP connector for extraction and the Work IQ SharePoint MCP connector for snapshot reads and report rows."
argument-hint: "Provide the MPP driveId/itemId or authorized HTTPS file reference, the configured task list identity, and the change-report list identity"
---

# MPP Change Watch Report

## Use When

- A SharePoint or OneDrive file trigger reports that an MPP project file was updated.
- Stakeholders need a categorized summary of what changed relative to the last synchronized state.

## Required MCP Capabilities

- Tools: `create_session_from_reference`, `create_session_from_onedrive`, `get_project`, `list_tasks`, `list_resources`, `list_assignments`, `close_session`.
- Work IQ SharePoint MCP connector capability: list item read on the configured task list and item create on the configured change-report list, available to the configured agent connection.
- PDS Project AI scope: `Session.ReadOnly`.

## Workflow

1. Accept the file identity from the trigger: preferably SharePoint/OneDrive `driveId` and `itemId`, otherwise an authorized HTTPS reference plus file name.
2. Create one PDS Project AI session with `create_session_from_onedrive` for delegated Graph access or `create_session_from_reference` for an authorized HTTPS reference.
3. Call `get_project` and retrieve the complete task collection with `list_tasks`, resolving assigned resource names with `list_assignments` and `list_resources`. Follow pagination to the end.
4. Read all snapshot rows for the same file identity from the configured SharePoint task list, following pagination to the end.
5. Diff plan tasks against snapshot rows by task UID and classify each difference using the change categories in the owning agent instructions.
6. Create one change-report row in the configured report list with the change kind, per-category counts, and a bounded summary.
7. Close the PDS Project AI session after producing the result.
8. Return the change kind, counts, significant changes, report row identity, confidence, and any recoverable warning.

## Guardrails

- Do not use the Work IQ SharePoint MCP connector outside the configured task and report lists.
- Do not create, update, or delete the source MPP file through either MCP server, and do not update the task list itself.
- Never diff against an incomplete collection; both the plan tasks and the snapshot rows must be fully paginated before comparing.
- Cite task UIDs and before/after values for every reported change; never paraphrase a change without evidence.
- When no snapshot rows exist, report `initial` rather than fabricating a diff.
- Keep the change summary bounded; state the number of omitted entries when truncating.
- Use the change-report field mapping from the owning agent instructions. Do not maintain a separate map in this skill.

## Output Format

Return a concise operational result with:

1. Change kind: `initial`, `changed`, or `unchanged`.
2. Counts per change category.
3. The most significant changes with task UIDs and before/after values.
4. Source file identity and report row identity when created.
5. Missing evidence or mapping gaps.
6. Confidence: `high`, `medium`, or `low`.
7. Recoverable error or retry guidance when relevant.

## Error Handling

- If the file cannot be opened or parsed, close any created PDS Project AI session and return a structured `error` with retry-safe guidance; make no SharePoint change.
- If the snapshot list cannot be read or pagination is incomplete on either side, return `failed` with the affected scope and create no report row.
- If identity is insufficient to match snapshot rows to the triggering file, return `failed` with the missing identity fields and make no SharePoint change.
