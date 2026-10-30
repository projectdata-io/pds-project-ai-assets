---
name: mpp-progress-editor
description: "Stage and validate Microsoft Project task progress updates through PDS Project AI. Use for percent complete, remaining duration, actual finish, stop/resume, and physical progress changes."
argument-hint: "Provide the MPP source or session ID and explicit task progress updates"
---

# MPP Progress Editor

## Use When

- The user explicitly asks to update task progress or actual status fields.
- Updates identify tasks and intended values clearly.

## Required MCP Capabilities

- Tools: `create_session_from_reference`, `create_session_from_onedrive`, `get_edit_capabilities`, `list_tasks`, `create_edit_draft`, `add_edit_operations`, `replace_edit_operations`, `preview_edit_draft`, `validate_edit_draft`, `close_session`.
- Scope: `Session.ReadWrite`.

## Workflow

1. Reuse a supplied session or create one authorized session and track ownership.
2. Call `get_edit_capabilities`; retrieve target tasks by UID and current progress fields.
3. Resolve every target to a unique `taskUid`. Reject ambiguous name-only requests.
4. Create `updateTask` operations using only explicitly requested supported fields such as `percentComplete`, `physicalPercentComplete`, `remainingDuration`, `actualFinish`, `stop`, or `resume`.
5. Reuse a supplied uncommitted draft or call `create_edit_draft`. If the existing draft already contains the requested updates, do not append them again; ask for draft context if its operations are unknown. Otherwise call `add_edit_operations` once with the updates. Preview and validate; after `replace_edit_operations`, repeat both checks.
6. Return `sessionId`, `editId`, validation status, intended updates, and session ownership. Pass that existing draft to `mpp-safe-commit` only for a requested write; draft-only requests remain uncommitted.

## Guardrails

- Do not infer actual dates from scheduled dates.
- Do not automatically force related percent fields to match.
- Do not target summary, inserted-subproject, read-only, external, or cross-project tasks when prohibited.
- Never call `commit_edit_draft`.

## Output Format

Return the validated draft, requested values, and affected task UIDs; do not claim persistence before commit.

## Error Handling

- On validation failure, preserve user intent and repair only invalid representations.
- If a requested field is unsupported, report the gap and ask for an alternative; do not silently omit it.
- Pass session ownership with the draft to `mpp-safe-commit`. Keep the session open for commit, download, or follow-up; close only a session you created when abandoned or no longer needed.

## Compatibility

Uses the current public PDS Project AI `updateTask` progress fields and draft lifecycle.