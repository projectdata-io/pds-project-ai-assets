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
5. Preview and validate. If repaired with `replace_edit_operations`, repeat both checks.
6. Stop before commit and hand off the unchanged validated draft to `mpp-safe-commit`.

## Guardrails

- Do not infer actual dates from scheduled dates.
- Do not automatically force related percent fields to match.
- Do not target summary, inserted-subproject, read-only, external, or cross-project tasks when prohibited.
- Never call `commit_edit_draft`.

## Output Format

Return target UIDs, before/requested values, draft ID, preview, validation issues, and explicit not-yet-committed status.

## Error Handling

- On validation failure, preserve user intent and repair only invalid representations.
- If a requested field is unsupported, omit it and ask for an alternative.
- Keep a skill-owned session open for safe-commit handoff; otherwise close it when abandoned.

## Compatibility

Uses the current public PDS Project AI `updateTask` progress fields and draft lifecycle.