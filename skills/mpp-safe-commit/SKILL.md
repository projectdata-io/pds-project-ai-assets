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

- Tools: `create_session_from_reference`, `create_session_from_onedrive`, `create_new_project_session`, `get_edit_capabilities`, `get_project`, `list_tasks`, `list_resources`, `list_assignments`, `create_edit_draft`, `add_edit_operations`, `replace_edit_operations`, `preview_edit_draft`, `validate_edit_draft`, `commit_edit_draft`, `open_project_plan_download`, `close_session`.
- Scope: `Session.ReadWrite` for editing and commit operations.

## Workflow

1. Confirm the requested write and output target from the conversation. A clear write request is authorization; analysis and draft-only requests are not. Ask only for missing inputs or material ambiguity.
2. Reuse the supplied `sessionId` and `editId`. Do not create a replacement draft or append operations when an existing draft was supplied. If no draft was supplied, reuse or create an authorized session, call `get_edit_capabilities`, resolve stable entity UIDs, then call `create_edit_draft` and `add_edit_operations` once with the requested changes.
3. Preview and validate that draft with `preview_edit_draft` and `validate_edit_draft`. Repair unchanged intent using `replace_edit_operations` with the complete corrected list and repeat both checks. Stop if a correction changes the requested outcome.
4. Resolve provider requirements from `get_edit_capabilities`. Never invent destinations or overwrite behavior. Use the source `ifMatch` when available and one `idempotencyKey` per logical commit, unchanged on retries.
5. Call `commit_edit_draft` with the same validated `editId`. Omit `returnFormat`; set a provider target only when requested and all required fields are resolved. For an intermediate creation stage, omit the provider target, return the committed IDs to the authoring workflow, and keep the session open without presenting a final download.
6. After the final commit, verify provider write-back or call `open_project_plan_download` with the committed `sessionId` and file name. Report completion only when the output is available.

## Guardrails

- Never turn advice or analysis into a write operation without an explicit edit request.
- Never commit an invalid or ambiguously targeted draft.
- Do not invent drive IDs, item IDs, parent IDs, upload URLs, file names, ETags, or target modes.
- Do not edit protected, inserted-subproject, external, cross-project, or read-only tasks when prohibited by the capability contract.
- Do not retry with a new idempotency key. On an ETag conflict, stop and ask the user to refresh or choose a new target.
- Never display raw credentials, signed URLs, or provider diagnostics as visible prose. A user-facing download URL may appear only as the destination of a labeled Markdown link; never include it in logs or diagnostics.

## Output Format

Return the confirmed commit status, file or provider destination, and concise change summary. For intermediate commits, return `sessionId`, `editId`, and the committed stage instead of claiming the complete file is ready.

## Error Handling

- On validation failure, preserve the request and repair the draft when the fix does not alter user intent; ask only when a real decision is needed.
- On provider or transient failure, follow returned retry guidance and reuse the same idempotency key.
- On an explicit missing/expired session, stop and report the last confirmed stage; do not replay possibly committed edits blindly.
- Close only sessions created by this workflow, including ownership explicitly transferred by an authoring skill. Keep them open while a download or follow-up still needs them; close when abandoned or no longer needed.

## Compatibility

Uses the current public PDS Project AI capability-discovery, draft, preview, validation, commit, project-query, session-creation, and cleanup tools.