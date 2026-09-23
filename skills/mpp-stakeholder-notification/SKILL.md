---
name: mpp-stakeholder-notification
description: "Derive per-audience notification entries from an updated Microsoft Project MPP file using the PDS Project AI MCP connector for extraction and record them in a configured SharePoint notification list through the Work IQ SharePoint MCP connector."
argument-hint: "Provide the MPP driveId/itemId or authorized HTTPS file reference and the configured SharePoint notification list identity"
---

# MPP Stakeholder Notification

## Use When

- A SharePoint or OneDrive file trigger reports that an MPP project file was created or updated.
- Affected resources and the project manager should receive evidence-backed notification entries about overdue work, upcoming starts, and due milestones.

## Required MCP Capabilities

- Tools: `create_session_from_reference`, `create_session_from_onedrive`, `get_project`, `list_tasks`, `list_resources`, `list_assignments`, `close_session`.
- Work IQ SharePoint MCP connector capability: list item read, create, and update operations available to the configured agent connection.
- PDS Project AI scope: `Session.ReadOnly`.

## Workflow

1. Accept the file identity from the trigger: preferably SharePoint/OneDrive `driveId` and `itemId`, otherwise an authorized HTTPS reference plus file name.
2. Create one PDS Project AI session with `create_session_from_onedrive` for delegated Graph access or `create_session_from_reference` for an authorized HTTPS reference.
3. Call `get_project` for the project title and status date, and retrieve the complete task, resource, and assignment collections with `list_tasks`, `list_resources`, and `list_assignments`, following pagination to the end.
4. Derive the notification-relevant conditions per the owning agent's rules: overdue incomplete tasks, tasks starting within the lookahead window, milestones due within the window, and near-term handoffs.
5. Group evidence by audience and compose one bounded notification entry per audience, citing task UIDs, names, and dates.
6. Upsert each entry into the configured SharePoint notification list keyed by file identity, audience, and run date.
7. Close the PDS Project AI session after producing the result.
8. Return the entries written, audiences covered, window used, confidence, and any recoverable warning.

## Guardrails

- Do not use the Work IQ SharePoint MCP connector outside the configured notification list.
- Do not create, update, or delete the source MPP file through either MCP server.
- Never send notifications directly; this workflow only records entries for downstream delivery.
- Never compose entries from an incomplete collection; pagination must be exhausted before deriving conditions.
- Cite task UIDs for every notification item; never include a task without its extracted evidence.
- Skip writing an entry when an audience has no matching evidence; do not write empty notifications.
- Keep each entry bounded; state the number of omitted items when truncating.
- Use the notification field mapping and rules from the owning agent instructions. Do not maintain a separate map in this skill.

## Output Format

Return a concise operational result with:

1. Number of notification entries written or updated.
2. Audiences covered and the lookahead window used.
3. Source file identity used for matching.
4. Missing evidence or mapping gaps.
5. Confidence: `high`, `medium`, or `low`.
6. Recoverable error or retry guidance when relevant.

## Error Handling

- If the file cannot be opened or parsed, close any created PDS Project AI session and return a structured `error` with retry-safe guidance; write no notification entries.
- If pagination is incomplete, make no SharePoint change and return `failed` with the affected scope.
- If identity is insufficient for reliable entry matching, return `failed` with the missing identity fields and make no SharePoint change.
