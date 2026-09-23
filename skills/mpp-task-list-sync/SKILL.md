---
name: mpp-task-list-sync
description: "Synchronize the task schedule of a created or updated Microsoft Project MPP file into a configured SharePoint task list using the PDS Project AI MCP connector for extraction and the Work IQ SharePoint MCP connector for task-row upserts."
argument-hint: "Provide the MPP driveId/itemId or authorized HTTPS file reference and the configured SharePoint task list identity"
---

# MPP Task List Sync

## Use When

- A SharePoint or OneDrive file trigger reports that an MPP project file was created or updated.
- The configured SharePoint task list should mirror the plan's tasks through row creation, update, or no-change reconciliation based on evidence extracted from the MPP.

## Required MCP Capabilities

- Tools: `create_session_from_reference`, `create_session_from_onedrive`, `get_project`, `list_tasks`, `list_resources`, `list_assignments`, `close_session`.
- Work IQ SharePoint MCP connector capability: list item read, create, and update operations available to the configured agent connection.
- PDS Project AI scope: `Session.ReadOnly`.

## Workflow

1. Accept the file identity from the trigger: preferably SharePoint/OneDrive `driveId` and `itemId`, otherwise an authorized HTTPS reference plus file name.
2. Create one PDS Project AI session with `create_session_from_onedrive` for delegated Graph access or `create_session_from_reference` for an authorized HTTPS reference.
3. Call `get_project` for the project title and retrieve the complete task collection with `list_tasks`, following pagination to the end. Resolve assigned resource names with `list_assignments` and `list_resources`.
4. Build one task-row payload per task, keyed by the composite of stable file identity and task UID, following the field mapping in the owning agent instructions.
5. Read the configured SharePoint task list rows for the source file identity. Create rows for unmatched task UIDs, update only changed evidence-backed fields on matched rows, and delete rows scoped to the triggering file whose task UIDs are absent from the extracted task set.
6. Close the PDS Project AI session after producing the result.
7. Return the action taken, per-action row counts, missing values, confidence, and any recoverable warning.

## Guardrails

- Do not use the Work IQ SharePoint MCP connector outside the configured task list.
- Do not create, update, or delete the source MPP file through either MCP server.
- Never write or delete list rows from an incomplete task collection; pagination must be exhausted before any upsert or deletion.
- Delete only rows whose composite key matches the triggering file identity and whose task UID is confirmed absent from the fully retrieved task set; never delete rows belonging to other source files.
- Do not treat missing dates, progress, predecessors, or resource names as empty strings when they are unknown; report them as `null` and include them in the result's missing values.
- Use stable identifiers such as `driveId`, `itemId`, project title, task UID, resource UID, and SharePoint item ID when present.
- Keep the result concise; do not embed full task collections.
- Use the task-list field mapping from the owning agent instructions. Do not maintain a separate field map in this skill.

## Output Format

Return a concise operational result with:

1. Action taken: `created`, `updated`, `unchanged`, or `failed`.
2. Source file identity used for matching.
3. SharePoint list identity when available.
4. Counts of created, updated, unchanged, and deleted rows.
5. Missing evidence or mapping gaps.
6. Confidence: `high`, `medium`, or `low`.
7. Recoverable error or retry guidance when relevant.

## Error Handling

- If the file cannot be opened or parsed, close any created PDS Project AI session and return a structured `error` with retry-safe guidance.
- If pagination is incomplete, make no SharePoint change (including no deletions) and return `failed` with the affected scope unless the caller explicitly allowed partial synchronization.
- If identity is insufficient for reliable row matching, return `failed` with the missing identity fields and make no SharePoint change.
- If a SharePoint write fails partway, report applied versus pending row keys. Upserts and deletions are idempotent by composite key, so a retry is safe.
