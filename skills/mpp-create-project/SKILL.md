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

- Tools: `create_project_schedule`, `create_new_project_session`, `get_edit_capabilities`, `create_edit_draft`, `add_edit_operations`, `preview_edit_draft`, `validate_edit_draft`, `commit_edit_draft`, `open_project_plan_download`, `get_project`, `list_tasks`, `list_resources`, `list_assignments`, `close_session`.
- Scope: `Session.ReadWrite`.

## Workflow

1. Gather the title, ISO `startDate`, work items, and material scheduling decisions. Preserve the request across answers. A request for a real project file is not a request for a text-only WBS. Treat an explicit draft-only or preview-only request, including "Build a draft schedule", as uncommitted; never call `create_project_schedule` for it because that tool commits.
	Apply PMI-aligned planning to agreed deliverables, scope boundaries, prerequisites, estimates, resource/calendar assumptions, and decision milestones. Tailor to the organization's delivery approach; request only material missing decisions, not a second authorization.
2. For an authorized completed-file request, call `create_project_schedule` once with the title, ISO `startDate`, parent-before-child tasks, unique `taskKey` values, `parentTaskKey` links, supported durations, and agreed dependencies. Include resources and assignments only when requested or agreed. It performs session creation, staging, UID resolution, preview, validation, commit, and delivery; do not start a second low-level creation workflow.
3. For a draft-only request, call `create_new_project_session`, then `get_edit_capabilities`; stage supported operations with `create_edit_draft` and `add_edit_operations`, using unique `opId` values, `parentTaskOpId` for a parent created earlier in the same draft, and `afterTaskOpId` for row ordering. These request-local operation IDs are not dependency or assignment UIDs. Preview and validate the draft, then return its `sessionId`, `editId`, and validation result without committing or opening a download. Leave UID-dependent relationship work pending rather than intermediate-committing.
4. Use `mpp-draft-repair` only for unchanged-intent corrections. Draft-only work must stop before every `commit_edit_draft` call.

## Guardrails

- Use source facts and agreed planning assumptions. Do not invent identifiers, dates, durations, units, resources, rates, links, or hierarchy.
- Use structured duration objects with explicit units when supplied.
- Claim only stages confirmed by successful tools. Report the actual tool error rather than inventing a limitation or final artifact.
- Use PMI/PMBOK principles as tailored recommendations, not invented thresholds or a certification checklist. State material assumptions and use the organization's specified edition/governance when supplied; otherwise use the public PMBOK Guide Eighth Edition overview as the reference basis.
- A committed MPP is not automatically an approved baseline. Never claim PMI compliance, certification, saved baselines, or unsupported planning features without the required evidence and supported tool confirmation.

## Output Format

For drafts, return `sessionId`, `editId`, validation status, and remaining stages. For completed files, report the confirmed output, material planning assumptions, remaining governance decisions, and any limitations.

## Error Handling

- Repair invalid operations when doing so preserves the requested requirements, then preview and validate again.
- If a needed operation is unsupported, report it rather than silently dropping requested work.
- On a later-stage failure, report any intermediate commits; the partial file is not the complete requested result.
- Keep the session open for commit, download, and follow-up. Transfer ownership to the commit workflow; close a session you created when abandoned or no longer needed.

## Compatibility

Uses the current public PDS Project AI blank-project, capability-discovery, draft, preview, validation, and query tools.