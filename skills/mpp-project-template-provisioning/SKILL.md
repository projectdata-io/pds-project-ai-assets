---
name: mpp-project-template-provisioning
description: "Provision a new Microsoft Project MPP file by copying an approved template within configured SharePoint libraries through the Work IQ SharePoint MCP connector, optionally informed by a referenced project charter/meeting-minutes document and configured company methodology/standards documents, customize the copy through the guarded PDS Project AI draft lifecycle, and record the result in a configured SharePoint list."
argument-hint: "Provide the template file name, the new project file name, any requested customizations, an optional referenced project-documentation file, and the configured template library, target library, projects list, project-documentation library, and company-documents library identities"
---

# MPP Project Template Provisioning

## Use When

- A request asks to create a new project file from an approved MPP template.
- The requester optionally wants the copy customized (renamed project, shifted dates, substituted resources) before registration.
- The requester optionally references a project charter or meeting-minutes document, or the agent configuration references company methodology/standards documents, whose explicitly stated facts or conventions should inform the customization.
- The provisioned project should be verified and registered in the configured SharePoint projects list.

## Required MCP Capabilities

- Tools: `create_session_from_reference`, `create_session_from_onedrive`, `get_project`, `list_tasks`, `list_resources`, `list_assignments`, `close_session`. Draft and commit orchestration is delegated to `mpp-safe-commit`, which carries the edit capability tools.
- Work IQ SharePoint MCP connector capability: file read and copy within the configured template and target libraries; file content read within the configured project-documentation library and company-documents library; and list item read, create, and update on the configured projects list, available to the configured agent connection.
- PDS Project AI scope: `Session.ReadWrite` (required for draft and commit; read tools run under the same session). PDS Project AI MCP tools parse Microsoft Project files only; they are never used to open a charter, meeting-minutes, or standards document.

## Workflow

1. Accept the provisioning request: template file name, new project file name, target folder, any requested customizations, and an optional reference to a project-documentation file.
2. Locate the template in the configured template library by exact file name. Stop and ask when the match is ambiguous.
3. Check the target folder for an existing file with the requested name. Stop and report the conflict when one exists; never overwrite.
4. Copy the template to the target folder under the new name through the Work IQ SharePoint MCP connector and capture the provisioned file's `driveId` and `itemId`.
5. Open the provisioned file with `create_session_from_onedrive` or `create_session_from_reference` and confirm it parses. Read the project title with `get_project` and summary dates from the UID `0` task in `list_tasks`. Use `list_resources` and `list_assignments` to resolve placeholder resources by stable UID for any requested substitution.
6. When the request references a project charter/meeting-minutes document, read its content from the configured project-documentation library through the Work IQ SharePoint MCP connector. Extract only literal, explicitly stated facts (title, objectives, dates, named stakeholders) as candidate customization values; cite the document identity alongside each.
7. When company methodology/standards documents are configured, read their content from the configured company-documents library. Extract only literal, explicitly stated conventions (required milestones, calendar conventions, mandatory review gates) as candidate customization values; cite the document identity alongside each.
8. Merge candidate values into the customization set: an explicit request value always wins over a document-derived value for the same field; report any such conflict and the discarded document value.
9. When the merged customization set is non-empty, hand the verified session and the complete customization set to `mpp-safe-commit`, which discovers edit capabilities, stages the complete operation set in one draft, previews, validates, obtains confirmation — including every document-derived value — and commits back to the provisioned file. When the set is empty, skip this step.
10. Record the provisioned project in the configured SharePoint projects list, keyed by the provisioned file's stable identity, following the field mapping in the owning agent instructions, including any project-documentation or company-documents references used. Close the PDS Project AI session.
11. Return the action taken, template used, document references used and the values they contributed, provisioned file identity, verified values, list row identity, confidence, and any recoverable warning.

## Guardrails

- Do not use the Work IQ SharePoint MCP connector outside the configured template library, target library, projects list, project-documentation library, and company-documents library.
- Never copy files that are not in the configured template library.
- Never overwrite an existing file in the target library.
- Apply only explicitly requested customizations plus literal, explicitly stated values or conventions from a referenced project-documentation or configured company-documents document; never invent project titles, dates, durations, resources, rates, or identifiers, and never infer a value a source document only implies.
- Never open a charter, meeting-minutes, or standards document through PDS Project AI MCP tools; those tools parse Microsoft Project files only.
- Never fetch or treat as authoritative a document outside the configured project-documentation or company-documents library, even if the requester names it.
- When extraction from a document is unreliable, treat the value as missing and report it in missing values rather than guessing.
- When a document-derived value conflicts with an explicit request, keep the explicit request and report the discarded document value; never silently prefer the document.
- Never commit an unpreviewed, invalid, or changed-since-confirmation draft. Confirmation must follow preview and validation and must include every document-derived value in the draft.
- Use one stable idempotency key per logical commit and preserve it across retries. Do not retry with a new key.
- Never record a projects-list row for a copy that has not been verified, or for a customization whose commit has not succeeded.
- Do not treat missing titles, dates, or document-derived values as empty strings when they are unknown; report them as `null` and include them in the result's missing values.
- Use stable identifiers such as `driveId`, `itemId`, template file identity, document file identity, and SharePoint list item ID when present.
- Keep the result concise; do not embed project collections or full document text.
- Use the projects-list field mapping from the owning agent instructions. Do not maintain a separate field map in this skill.

## Output Format

Return a concise operational result with:

1. Action taken: `provisioned`, `provisioned-customized`, or `failed`.
2. Template file identity used.
3. Project-documentation and company-documents references used, and the values each contributed.
4. Provisioned file identity (`driveId`, `itemId`) and name.
5. Verified project title and summary dates.
6. SharePoint projects-list row identity when written.
7. Missing evidence or mapping gaps, including unreliable document extractions and any explicit-vs-document conflicts.
8. Confidence: `high`, `medium`, or `low`.
9. Recoverable error or retry guidance when relevant.

## Error Handling

- If the template cannot be found or the match is ambiguous, return `failed` with the candidates and make no change.
- If the target file name already exists, return `failed` with the conflicting file identity and make no change.
- If a referenced project-documentation file cannot be found or opened, proceed using only explicitly requested customizations and report the reference as unresolved.
- If the copy succeeds but the provisioned file fails to parse, report the failure stage and name the orphaned copy's identity for manual review; do not delete it without explicit confirmation and write no projects-list row.
- If draft validation cannot be repaired to a passing state, stop before commit, report the validation issues, and leave the copied file unchanged.
- If commit reports an ETag or concurrency conflict, stop and ask the user to refresh rather than overwriting newer content.
- If identity is insufficient for reliable row matching, return `failed` with the missing identity fields and make no SharePoint list change.
