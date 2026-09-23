---
name: mpp-progress-request
description: "Seed a configured SharePoint intake list with per-resource progress request rows derived from a Microsoft Project MPP file's active assignments, using the PDS Project AI MCP connector for extraction and the Work IQ SharePoint MCP connector for row creation."
argument-hint: "Provide the source MPP driveId/itemId or authorized reference and the configured SharePoint intake list identity"
---

# MPP Progress Request

## Use When

- A request asks to start a progress-reporting round for a plan: team members each need an intake-list row to report their task progress.
- The configured SharePoint intake list should be populated with pending progress requests for the plan's active assignments.

## Required MCP Capabilities

- Tools: `create_session_from_reference`, `create_session_from_onedrive`, `get_project`, `list_tasks`, `list_resources`, `list_assignments`, `close_session`.
- Work IQ SharePoint MCP connector capability: list item read and create on the configured intake list, available to the configured agent connection.
- PDS Project AI scope: `Session.ReadOnly`.

## Workflow

1. Accept the request: the source MPP identity and the configured intake list identity, plus the reporting window when the caller overrides the default.
2. Open the source file with `create_session_from_onedrive` or `create_session_from_reference`. Call `get_project` for the title and status date, and retrieve the complete task, resource, and assignment collections with `list_tasks`, `list_resources`, and `list_assignments`, following pagination to the end.
3. Derive the reportable set: non-summary, non-milestone, incomplete tasks that are in progress or due within the reporting window, joined to their assigned resources.
4. Read the intake list's existing rows for the same file identity and skip any task/resource pair that already has a pending row.
5. Create one pending intake row per remaining task/resource pair, carrying the file identity, task UID, task name, resource name, and empty progress fields. Follow the field mapping in the owning agent instructions.
6. Close the PDS Project AI session after producing the result.
7. Return the rows created, rows skipped as already-pending, the reportable scope, confidence, and any recoverable warning.

## Guardrails

- Do not use the Work IQ SharePoint MCP connector outside the configured intake list.
- Do not create, update, or delete the source MPP file through either MCP server.
- Never create a request row from an incomplete collection; pagination must be exhausted before deriving the reportable set.
- Never duplicate an open request: skip task/resource pairs that already have a pending row.
- Do not invent tasks, assignees, or progress values; every row must trace to an extracted assignment by task UID and resource UID.
- Only create rows for the reportable set; do not seed completed, summary, or milestone tasks.
- Keep the result concise; do not embed full task or resource collections.
- Use the intake field mapping from the owning agent instructions. Do not maintain a separate map in this skill.

## Output Format

Return a concise operational result with:

1. Number of pending request rows created.
2. Number skipped as already-pending.
3. The reportable scope used (window and selection rule).
4. Source file identity.
5. Missing evidence or mapping gaps.
6. Confidence: `high`, `medium`, or `low`.
7. Recoverable error or retry guidance when relevant.

## Error Handling

- If the file cannot be opened or parsed, close any created session and return a structured `error` with retry-safe guidance; create no rows.
- If pagination is incomplete on either the plan collections or the existing intake rows, make no SharePoint change and return `failed` with the affected scope.
- If identity is insufficient to scope intake rows to the file, return `failed` with the missing identity fields and make no SharePoint change.
