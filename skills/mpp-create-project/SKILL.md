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

- Tools: `create_new_project_session`, `get_edit_capabilities`, `create_edit_draft`, `add_edit_operations`, `preview_edit_draft`, `validate_edit_draft`, `commit_edit_draft`, `get_project`, `list_tasks`, `list_resources`, `list_assignments`, `close_session`.
- Scope: `Session.ReadWrite`.

## Workflow

1. Treat a request to create, build, or generate a Microsoft Project plan from requirements or a WBS as a request to use PDS tools, not to return a text-only substitute.
2. `create_new_project_session` requires `title` and ISO `startDate`; ask only for a required value that is missing or ambiguous. A relative label such as “Day 1” is not an ISO date.
3. Call `create_new_project_session`, then `get_edit_capabilities`.
4. Create one draft. Add deterministic `createTask` operations with unique `opId` values and `afterTaskOpId` chains for sibling order. Use `parentTaskUid` or `outlineLevel` only when they unambiguously describe the intended hierarchy.
5. Add supported project property and resource operations. Assignment operations may target only known persisted task and resource UIDs; if newly created entity UIDs are required, stage and validate creation first rather than inventing UIDs.
6. Add supported dependency links only between known task UIDs.
7. Preview and validate internally. Note omissions caused by unavailable UIDs or unsupported capabilities.
8. Call the exposed `commit_edit_draft` MCP tool directly after validation and target requirements are satisfied. Do not stop at a validated draft. If a OneDrive/SharePoint create target requires unresolved `driveId` or `parentId`, finish and validate the draft first, then ask only for the destination folder or link.

## Guardrails

- Do not invent dates, durations, units, resources, rates, links, or hierarchy.
- Use structured duration objects with explicit units when supplied.
- Do not create a detailed schedule from a vague goal without gathering requirements.
- Never claim that a plan was created, saved, or validated unless the corresponding PDS tool returned success. If a tool is unavailable or fails, report the actual error rather than falling back to a fabricated validation summary.
- Never claim commit success unless `commit_edit_draft` returns success.

## Output Format

Return the completed project and any material deferred items. Keep draft mechanics out of the user-facing summary.

## Error Handling

- Repair invalid operations when doing so preserves the requested requirements, then preview and validate again.
- If a needed operation is unsupported, omit it and explain the limitation.
- Keep the session open for the safe-commit workflow; close it only when the request is abandoned.

## Compatibility

Uses the current public PDS Project AI blank-project, capability-discovery, draft, preview, validation, and query tools.