---
name: mpp-change-impact-report
description: "Explain the previewed impact of an MPP edit draft through PDS Project AI. Use for change review, approval briefs, and before-commit schedule impact reporting."
argument-hint: "Provide the session ID and edit ID for an existing draft"
---

# MPP Change Impact Report

## Use When

- An edit draft exists and the user wants to understand its effects before commit.
- An approver needs a concise review of proposed schedule or entity changes.

## Required MCP Capabilities

- Tools: `get_project`, `list_tasks`, `list_resources`, `list_assignments`, `preview_edit_draft`, `validate_edit_draft`.
- Scopes: `Session.ReadOnly` for preview and reads; `Session.ReadWrite` for validation.

## Workflow

1. Require an existing caller-supplied `sessionId` and `editId`. Do not create or alter a draft.
2. Read current affected entities and call `preview_edit_draft`.
3. Call `validate_edit_draft` and retain every structured issue and warning.
4. Explain created, updated, deleted, linked, or unlinked entities and any previewed schedule effects using stable UIDs or operation IDs.
5. Separate direct operation effects from recalculated or inferred downstream effects.
6. Stop without committing. Hand off an unchanged, validated draft to `mpp-safe-commit` only if the user requests persistence.

## Guardrails

- Do not claim an effect that the preview does not expose.
- Do not modify operations to make the report cleaner.
- Do not treat validation success as persistence.
- Never call `commit_edit_draft`.

## Output Format

Return draft identity, operation summary, direct impacts, schedule/recalculation effects, validation result, unresolved issues, destination status if known, and explicit not-yet-committed status.

## Error Handling

- If the draft is invalid, report all issues and recommend `mpp-draft-repair` without changing it.
- If the session or draft is unavailable, stop; do not recreate or replay it.

## Compatibility

Uses the current public PDS Project AI draft preview, validation, and entity query tools.