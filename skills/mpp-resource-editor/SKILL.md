---
name: mpp-resource-editor
description: "Stage and validate Microsoft Project resource and assignment edits through PDS Project AI. Use for creating or updating resources, changing units, assigning work, or removing assignments and resources."
argument-hint: "Provide the MPP source or session ID and exact resource or assignment changes"
---

# MPP Resource Editor

## Use When

- The user explicitly asks to create, update, deactivate, or remove resources.
- The user asks to create, update, or remove assignments or assignment units.

## Required MCP Capabilities

- Tools: `create_session_from_reference`, `create_session_from_onedrive`, `get_edit_capabilities`, `list_tasks`, `list_resources`, `list_assignments`, `create_edit_draft`, `add_edit_operations`, `replace_edit_operations`, `preview_edit_draft`, `validate_edit_draft`, `close_session`.
- Scope: `Session.ReadWrite`.

## Workflow

1. Reuse a supplied session or create one authorized session and track ownership.
2. Call `get_edit_capabilities`; retrieve complete target resource, assignment, and task UIDs.
3. Construct only supported `createResource`, `updateResource`, `deleteResource`, `createAssignment`, `updateAssignment`, and `deleteAssignment` operations.
4. Never provide `active` and `isInactive` together. Preserve supplied unit scale; ask only if fraction-versus-percentage interpretation is ambiguous.
5. Include assignment removals and affected target UIDs in the draft summary.
6. Preview and validate internally. Route a valid draft to `mpp-safe-commit` for direct persistence after validation.

## Guardrails

- Do not invent rates, units, email addresses, accounts, booking types, or resource types.
- Do not expose rates or personal fields outside the user's authorized request.
- Do not create assignments with guessed task or resource UIDs.
- Never call `commit_edit_draft`.

## Output Format

Return a concise summary of completed changes, affected UIDs, and material deletion consequences.

## Error Handling

- If new entities lack persisted UIDs needed for assignment creation, stage creation separately and explain the required follow-up.
- Repair invalid drafts with complete replacement operations and revalidate.
- Keep a skill-owned session open for safe commit; close it when abandoned.

## Compatibility

Uses the current public PDS Project AI resource and assignment edit operations and draft lifecycle.