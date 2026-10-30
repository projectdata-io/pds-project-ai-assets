---
name: mpp-draft-repair
description: "Repair an invalid Microsoft Project edit draft through PDS Project AI. Use for structured validation issues, unsupported fields, missing targets, duplicate operation IDs, and corrected operation replacement."
argument-hint: "Provide the session ID, edit ID, validation issues, and intended change"
---

# MPP Draft Repair

## Use When

- `validate_edit_draft` returns structured issues for an uncommitted draft.
- The user wants the same intended edit corrected without creating a new draft.

## Required MCP Capabilities

- Tools: `get_edit_capabilities`, `get_project`, `list_tasks`, `list_resources`, `list_assignments`, `replace_edit_operations`, `preview_edit_draft`, `validate_edit_draft`.
- Scope: `Session.ReadWrite`.

## Workflow

1. Require caller-supplied `sessionId`, `editId`, intended outcome, and the current complete operation list or sufficient draft context.
2. Call `get_edit_capabilities` and retrieve any target entities needed to resolve validation issues.
3. Map every issue code and path to the affected operation. Preserve valid intent and ordering while fixing only unsupported types, fields, values, targets, or duplicate IDs.
4. Repair automatically when the correction preserves the requested meaning and targets. Ask only if a repair would change the user's requested outcome.
5. Call `replace_edit_operations` with the complete non-empty corrected list.
6. Preview and validate again. Repeat only when new local validation issues clearly identify another repair.
7. Return the same `sessionId`, `editId`, corrected operations, and validation status to the calling workflow. Repair does not authorize persistence; the caller chooses commit only for an existing write request.

## Guardrails

- Do not silently drop an operation or substitute a different target.
- Ask only if value interpretation is ambiguous.
- Do not create a new draft unless the existing draft is unavailable.
- Never call `commit_edit_draft`.

## Output Format

Return a concise repair result and validation status, including any unresolved issue. Do not claim a commit.

## Error Handling

- If the draft or session is unavailable, stop; do not replay edits automatically.
- If required intent is ambiguous, request clarification before replacement.
- If a requested capability is unsupported, preserve that fact rather than approximating it.

## Compatibility

Uses the current public PDS Project AI capability discovery, replacement, preview, validation, and entity query tools.