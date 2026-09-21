---
name: mpp-create-project
description: "Create and validate a new Microsoft Project plan draft through PDS Project AI. Use for building a new MPP project, WBS, resources, assignments, and dependencies from explicit requirements."
argument-hint: "Provide project title, start date, WBS, resources, assignments, and dependencies"
---

# MPP Create Project

## Use When

- The user explicitly asks to create a new MPP plan.
- Requirements identify the intended tasks, hierarchy, durations, resources, assignments, and links.

## Required MCP Capabilities

- Tools: `create_new_project_session`, `get_edit_capabilities`, `create_edit_draft`, `add_edit_operations`, `preview_edit_draft`, `validate_edit_draft`, `get_project`, `list_tasks`, `list_resources`, `list_assignments`, `close_session`.
- Scope: `Session.ReadWrite`.

## Workflow

1. Confirm title, ISO date-time start, file name, scheduling assumptions, and explicit plan requirements.
2. Call `create_new_project_session`, then `get_edit_capabilities`.
3. Create one draft. Add deterministic `createTask` operations with unique `opId` values and `afterTaskOpId` chains for sibling order. Use `parentTaskUid` or `outlineLevel` only when they unambiguously describe the intended hierarchy.
4. Add supported project property and resource operations. Assignment operations may target only known persisted task and resource UIDs; if newly created entity UIDs are required, stage and validate creation first rather than inventing UIDs.
5. Add supported dependency links only between known task UIDs.
6. Preview and validate the draft. Present omissions caused by unavailable UIDs or unsupported capabilities.
7. Stop before commit and hand off the exact validated draft to `mpp-safe-commit` for confirmation and persistence.

## Guardrails

- Do not invent dates, durations, units, resources, rates, links, or hierarchy.
- Use structured duration objects with explicit units when supplied.
- Do not create a detailed schedule from a vague goal without gathering requirements.
- Never call `commit_edit_draft`.

## Output Format

Return session and draft IDs, staged project structure, operation count, preview, validation result, deferred items, and explicit not-yet-committed status.

## Error Handling

- Repair invalid operations only while preserving approved requirements, then preview and validate again.
- If a needed operation is unsupported, omit it and explain the limitation.
- Keep the session open for safe-commit handoff; close it only when the user abandons creation.

## Compatibility

Uses the current public PDS Project AI blank-project, capability-discovery, draft, preview, validation, and query tools.