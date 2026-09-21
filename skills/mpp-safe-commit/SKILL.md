---
name: mpp-safe-commit
description: "Safely stage, preview, validate, confirm, and commit Microsoft Project MPP edits through PDS Project AI. Use when a user explicitly asks to modify, create, or write back a project plan."
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

1. Require an explicit user request to modify the project. Establish the source, exact requested changes, output target, and whether the source session is caller-owned.
2. Reuse a supplied session, create one from an authorized source, or call `create_new_project_session` only when the user requested a new plan. Track session ownership.
3. Call `get_edit_capabilities` before constructing operations. Use only returned operation types, targets, change fields, and commit target requirements.
4. Read the affected project entities with stable UIDs. Reject name-only targeting when names are duplicated or ambiguous.
5. Refuse edits to master-project child nodes and tasks marked read-only, inserted-subproject, external, or cross-project when the capability contract prohibits them.
6. Create one edit draft with a descriptive label. Add the complete ordered operation set. Use explicit `opId` values when later operations refer to entities created earlier in the same draft.
7. Call `preview_edit_draft`, then `validate_edit_draft`. Present the preview, validation result, destination, overwrite/create mode, and material schedule effects to the user.
8. Do not commit until the user explicitly confirms that reviewed draft. Confirmation obtained before preview or before a repaired validation result is not sufficient.
9. If validation fails, repair the complete operation list with `replace_edit_operations`, then preview and validate again. Never remove an issue silently.
10. For provider overwrite, use the source `ifMatch` value when available. Use one stable `idempotencyKey` for the logical commit and preserve it unchanged across retries.
11. Call `commit_edit_draft` once confirmed. Request `downloadUrl` by default for user retrieval unless the user asks for another supported return format or provider target.
12. Verify the commit response before claiming success. Ensure the user has the resulting artifact or confirmed provider destination before closing a session owned by this skill.

## Guardrails

- Never turn advice or analysis into a write operation without an explicit edit request.
- Never commit an unpreviewed, invalid, changed-since-confirmation, or ambiguously targeted draft.
- Do not invent drive IDs, item IDs, parent IDs, upload URLs, file names, ETags, or target modes.
- Treat overwrite and external upload as consequential actions and name the destination before confirmation.
- Do not retry with a new idempotency key. On an ETag conflict, stop and ask the user to refresh or choose a new target.
- Do not expose raw credentials, signed URLs, or provider diagnostics in the narrative response.

## Confirmation Format

Before commit, show:

1. Source project and session.
2. Ordered operation summary with target UIDs.
3. Previewed schedule and entity impacts.
4. Validation status and unresolved warnings.
5. Destination, mode, return format, and overwrite consequences.
6. A direct request to confirm this exact draft.

## Output Format

After commit, return the commit status, resulting file name or provider destination, artifact availability, and concise applied-operation summary. Never claim persistence based only on draft validation.

## Error Handling

- On validation failure, preserve the draft, explain issues, repair only with user-approved intent, then repeat preview and validation.
- On provider or transient failure, follow returned retry guidance and reuse the same idempotency key.
- On session expiry before commit, do not silently recreate and replay operations; explain that the draft is unavailable and rebuild only with renewed user approval.
- Close only sessions created by this skill, and only after the output is secured or the workflow is abandoned.

## Compatibility

Uses the current public PDS Project AI capability-discovery, draft, preview, validation, commit, project-query, session-creation, and cleanup tools.