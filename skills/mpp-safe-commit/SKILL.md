---
name: mpp-safe-commit
description: "Stage, validate, and commit requested Microsoft Project edits through PDS Project AI. Use when a user asks to modify, create, or write back a project plan."
argument-hint: "Describe the requested MPP changes, source or session ID, and desired output target"
---

# MPP Safe Commit

## Use When

- The user explicitly requests an MPP change, new project plan, updated file, download, or OneDrive/SharePoint write-back.
- Another editing workflow has produced deterministic operations that require guarded commit orchestration.

## Do Not Use When

- The user asks only for analysis, recommendations, or a hypothetical scenario.
- The requested operation is absent from `get_edit_capabilities`.

## Required MCP Capabilities

- Tools: `create_session_from_reference`, `create_session_from_onedrive`, `create_new_project_session`, `get_edit_capabilities`, `get_project`, `list_tasks`, `list_resources`, `list_assignments`, `create_edit_draft`, `add_edit_operations`, `replace_edit_operations`, `preview_edit_draft`, `validate_edit_draft`, `commit_edit_draft`, `close_session`.
- Scope: `Session.ReadWrite` for editing and commit operations.

## Workflow

1. Treat a clear edit request as authorization to proceed. Establish the source, requested changes, output target, and session ownership; ask only for required details that are missing or ambiguous.
2. Reuse a supplied session, create one from an authorized source, or call `create_new_project_session` only when the user requested a new plan. Track session ownership.
3. Call `get_edit_capabilities` before constructing operations. Use only returned operation types, targets, change fields, and commit target requirements.
4. Read the affected project entities with stable UIDs. Reject name-only targeting when names are duplicated or ambiguous.
5. Refuse edits to master-project child nodes and tasks marked read-only, inserted-subproject, external, or cross-project when the capability contract prohibits them.
6. Create one edit draft with a descriptive label. Add the complete ordered operation set. Use explicit `opId` values when later operations refer to entities created earlier in the same draft.
7. Call `preview_edit_draft` and `validate_edit_draft` internally; commit requires a valid draft. Repair validation issues automatically when the requested intent is unchanged, then repeat both checks.
8. For provider overwrite, use the source `ifMatch` value when available. Use one stable `idempotencyKey` for the logical commit and preserve it unchanged across retries.
9. For OneDrive/SharePoint creation, satisfy `get_edit_capabilities` target requirements. Resolve `driveId`, `parentId`, and `fileName` from authorized context. If folder IDs remain unavailable, finish and validate the draft first, then ask only for the destination folder or link.
10. Call `commit_edit_draft` as soon as validation and target requirements are satisfied. Request `downloadUrl` by default when no provider target was requested; otherwise write to the requested provider target.
11. Verify the commit response before claiming success. Ensure the resulting artifact or provider destination is available before closing a session owned by this skill.

## Guardrails

- Never turn advice or analysis into a write operation without an explicit edit request.
- Never commit an invalid or ambiguously targeted draft.
- Do not invent drive IDs, item IDs, parent IDs, upload URLs, file names, ETags, or target modes.
- Ask for clarification only when overwrite mode or external upload destination is missing or ambiguous.
- Do not retry with a new idempotency key. On an ETag conflict, stop and ask the user to refresh or choose a new target.
- Never display raw credentials, signed URLs, or provider diagnostics as visible prose. A user-facing download URL may appear only as the destination of a labeled Markdown link; never include it in logs or diagnostics.

## Output Format

After commit, return the commit status, resulting file name or provider destination, artifact availability, and concise applied-operation summary. Never claim persistence based only on draft validation.
When the commit response includes `download.downloadUrl`, present it as a labeled Markdown link, for example `[Download the committed MPP](<exact download URL>)`. Preserve the URL exactly, including its query string, and do not print the signed URL as plain text.

## Error Handling

- On validation failure, preserve the request and repair the draft when the fix does not alter user intent; ask only when a real decision is needed.
- On provider or transient failure, follow returned retry guidance and reuse the same idempotency key.
- If the session is unavailable before commit, rebuild and validate from the same request. Ask only if the target or requested changes are ambiguous.
- Close only sessions created by this skill, and only after the output is secured or the workflow is abandoned.

## Compatibility

Uses the current public PDS Project AI capability-discovery, draft, preview, validation, commit, project-query, session-creation, and cleanup tools.