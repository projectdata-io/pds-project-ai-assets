---
name: mpp-portfolio-list-maintenance
description: "Maintain a SharePoint portfolio list row from a created or updated Microsoft Project MPP file using the PDS Project AI MCP connector for analysis and the Work IQ SharePoint MCP connector for the list upsert."
argument-hint: "Provide the MPP driveId/itemId or authorized HTTPS file reference and the configured SharePoint portfolio list identity"
---

# MPP Portfolio List Maintenance

## Use When

- A SharePoint or OneDrive file trigger reports that an MPP project file was created or updated.
- The corresponding portfolio-list item should be created, updated, or left unchanged based on evidence extracted from the MPP.

## Required MCP Capabilities

- Tools: `create_session_from_reference`, `create_session_from_onedrive`, `get_project`, `list_tasks`, `list_resources`, `list_assignments`, `close_session`.
- Work IQ SharePoint MCP connector capability: list item read, create, and update operations available to the configured agent connection.
- PDS Project AI scope: `Session.ReadOnly`.

## Workflow

1. Accept the file identity from the trigger: preferably SharePoint/OneDrive `driveId` and `itemId`, otherwise an authorized HTTPS reference plus file name.
2. Create one PDS Project AI session with `create_session_from_onedrive` for delegated Graph access or `create_session_from_reference` for an authorized HTTPS reference.
3. Call `get_project` and retrieve bounded task, resource, and assignment collections with `list_tasks`, `list_resources`, and `list_assignments`. Follow pagination when present.
4. Derive portfolio values from returned fields only, following the field mapping in the owning agent instructions.
5. Read the configured SharePoint portfolio list item by stable file identity. Create the item when no match exists and the target mapping is known; update only changed evidence-backed fields when it exists.
6. Close the PDS Project AI session after producing the result.
7. Return the action taken, item identity, changed fields, missing values, confidence, and any recoverable warning.

## Guardrails

- Do not use the Work IQ SharePoint MCP connector outside the configured portfolio list.
- Do not create, update, or delete the source MPP file through either MCP server.
- Do not treat missing resource owners, sponsor names, costs, or status values as empty strings when they are unknown; report them as `null` and include them in the result's missing values.
- Use stable identifiers such as `driveId`, `itemId`, project title, task UID, milestone UID, resource UID, and SharePoint item ID when present.
- Keep the result concise; do not embed full project collections.
- Use the portfolio-list field mapping from the owning agent instructions. Do not maintain a separate field map in this skill.

## Output Format

Return a concise operational result with:

1. Action taken: `created`, `updated`, `unchanged`, or `failed`.
2. Source file identity used for matching.
3. SharePoint list item identity when available.
4. Updated field names and skipped field names.
5. Missing evidence or mapping gaps.
6. Confidence: `high`, `medium`, or `low`.
7. Recoverable error or retry guidance when relevant.

## Error Handling

- If the file cannot be opened or parsed, close any created PDS Project AI session and return a structured `error` with retry-safe guidance.
- If pagination is incomplete, do not write the incomplete payload; return `failed` with affected fields unless the caller explicitly allowed partial updates.
- If identity is insufficient for reliable upsert matching, return `failed` with the missing identity fields and make no SharePoint change.
