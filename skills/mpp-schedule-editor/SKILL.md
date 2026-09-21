---
name: mpp-schedule-editor
description: "Stage and validate Microsoft Project task, hierarchy, duration, milestone, constraint, and dependency edits through PDS Project AI. Use for explicit schedule restructuring requests."
argument-hint: "Provide the MPP source or session ID and exact schedule changes"
---

# MPP Schedule Editor

## Use When

- The user explicitly asks to create, update, delete, link, or unlink tasks.
- The user requests milestone, duration, start, constraint, priority, or hierarchy changes.

## Required MCP Capabilities

- Tools: `create_session_from_reference`, `create_session_from_onedrive`, `get_edit_capabilities`, `list_tasks`, `create_edit_draft`, `add_edit_operations`, `replace_edit_operations`, `preview_edit_draft`, `validate_edit_draft`, `close_session`.
- Scope: `Session.ReadWrite`.

## Workflow

1. Reuse a supplied session or create one authorized session and track ownership.
2. Call `get_edit_capabilities` and retrieve complete task identifiers, hierarchy, dates, state markers, and predecessor links needed for targeting.
3. Resolve targets by UID. Construct only supported `createTask`, `updateTask`, `deleteTask`, `linkTasks`, and `unlinkTasks` operations.
4. For created sibling order, use unique `opId` and `afterTaskOpId`. Do not combine `afterTaskUid` and `afterTaskOpId`.
5. Express durations with explicit units. Preserve requested link type and lag without conversion unless the contract defines it.
6. Preview and validate. Report downstream recalculation effects and destructive deletions.
7. Stop before commit and hand off the unchanged validated draft to `mpp-safe-commit`.

## Guardrails

- Do not invent dependencies or constraints to make dates fit.
- Do not delete a task without showing its UID and previewed impact.
- Do not edit protected master-project, external, cross-project, or read-only tasks.
- Never call `commit_edit_draft`.

## Output Format

Return ordered operations, target UIDs/opIds, previewed schedule effects, validation result, destructive impacts, and explicit not-yet-committed status.

## Error Handling

- Replace invalid operation lists only with a complete corrected list, then preview and validate again.
- On unresolved targets or cycles, stop and request clarification.
- Keep a skill-owned session open for safe-commit handoff; close it when abandoned.

## Compatibility

Uses the current public PDS Project AI task and dependency edit operations and draft lifecycle.