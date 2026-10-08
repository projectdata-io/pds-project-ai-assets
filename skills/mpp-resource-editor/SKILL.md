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
5. Reuse a supplied uncommitted draft or call `create_edit_draft`. If it already contains the requested changes, do not append them again; ask for draft context if its operations are unknown. Otherwise call `add_edit_operations` once with the ordered changes. Include assignment removals and affected UIDs.
6. Preview and validate. Return `sessionId`, `editId`, validation status, intended changes, and session ownership. Pass the existing draft to `mpp-safe-commit` only for a requested write; draft-only requests remain uncommitted.

## Guardrails

- Do not invent rates, units, email addresses, accounts, booking types, or resource types.
- Do not expose rates or personal fields outside the user's authorized request.
- Do not create assignments with guessed task or resource UIDs.
- Never call `commit_edit_draft`.

## Output Format

Return the validated draft, affected UIDs, and material deletion consequences; do not claim persistence before commit.

## Error Handling

- When assignment creation needs new entity UIDs, stage and validate entity creation first. For a requested write, pass that draft to `mpp-safe-commit` as an intermediate session-only commit, read the persisted tasks/resources, resolve their actual UIDs, then create and validate an assignment draft. Pass the final draft and provider target to `mpp-safe-commit`. For a draft-only request, report the pending assignment stage without committing.
- Report partial completion if entity creation committed but a later stage failed; never guess UIDs or replay creation blindly.
- Repair invalid drafts with complete replacement operations and revalidate.
- Pass session ownership with the draft to `mpp-safe-commit`. Keep the session open for commit, download, or follow-up; close only a session you created when abandoned or no longer needed.

## Compatibility

Uses the current public PDS Project AI resource and assignment edit operations and draft lifecycle.