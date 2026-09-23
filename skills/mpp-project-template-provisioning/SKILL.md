---
name: mpp-project-template-provisioning
description: "Provision a new Microsoft Project MPP file by copying an approved template within configured SharePoint libraries through the Work IQ SharePoint MCP connector, customize the copy through the guarded PDS Project AI draft lifecycle, and record the result in a configured SharePoint list."
argument-hint: "Provide the template file name, the new project file name, any requested customizations, and the configured template library, target library, and projects list identities"
---

# MPP Project Template Provisioning

## Use When

- A request asks to create a new project file from an approved MPP template.
- The requester optionally wants the copy customized (renamed project, shifted dates, substituted resources) before registration.
- The provisioned project should be verified and registered in the configured SharePoint projects list.

## Required MCP Capabilities

- Tools: `create_session_from_reference`, `create_session_from_onedrive`, `get_project`, `list_tasks`, `list_resources`, `list_assignments`, `close_session`. Draft and commit orchestration is delegated to `mpp-safe-commit`, which carries the edit capability tools.
- Work IQ SharePoint MCP connector capability: file read and copy within the configured template and target libraries, and list item read, create, and update on the configured projects list, available to the configured agent connection.
- PDS Project AI scope: `Session.ReadWrite` (required for draft and commit; read tools run under the same session).

## Workflow

1. Accept the provisioning request: template file name, new project file name, target folder, and any requested customizations.
2. Locate the template in the configured template library by exact file name. Stop and ask when the match is ambiguous.
3. Check the target folder for an existing file with the requested name. Stop and report the conflict when one exists; never overwrite.
4. Copy the template to the target folder under the new name through the Work IQ SharePoint MCP connector and capture the provisioned file's `driveId` and `itemId`.
5. Open the provisioned file with `create_session_from_onedrive` or `create_session_from_reference` and confirm it parses. Read the project title with `get_project` and summary dates from the UID `0` task in `list_tasks`. Use `list_resources` and `list_assignments` to resolve placeholder resources by stable UID for any requested substitution.
6. When the request includes customizations, hand the verified session and the explicit customization set to `mpp-safe-commit`, which discovers edit capabilities, stages the complete operation set in one draft, previews, validates, obtains confirmation, and commits back to the provisioned file. When the request has no customizations, skip this step.
7. Record the provisioned project in the configured SharePoint projects list, keyed by the provisioned file's stable identity, following the field mapping in the owning agent instructions. Close the PDS Project AI session.
8. Return the action taken, template used, provisioned file identity, verified values, list row identity, confidence, and any recoverable warning.

## Guardrails

- Do not use the Work IQ SharePoint MCP connector outside the configured template library, target library, and projects list.
- Never copy files that are not in the configured template library.
- Never overwrite an existing file in the target library.
- Apply only explicitly requested customizations; never invent project titles, dates, durations, resources, rates, or identifiers.
- Never commit an unpreviewed, invalid, or changed-since-confirmation draft. Confirmation must follow preview and validation.
- Use one stable idempotency key per logical commit and preserve it across retries. Do not retry with a new key.
- Never record a projects-list row for a copy that has not been verified, or for a customization whose commit has not succeeded.
- Do not treat missing titles or dates as empty strings when they are unknown; report them as `null` and include them in the result's missing values.
- Use stable identifiers such as `driveId`, `itemId`, template file identity, and SharePoint list item ID when present.
- Keep the result concise; do not embed project collections.
- Use the projects-list field mapping from the owning agent instructions. Do not maintain a separate field map in this skill.

## Output Format

Return a concise operational result with:

1. Action taken: `provisioned`, `provisioned-customized`, or `failed`.
2. Template file identity used.
3. Provisioned file identity (`driveId`, `itemId`) and name.
4. Verified project title and summary dates.
5. SharePoint projects-list row identity when written.
6. Missing evidence or mapping gaps.
7. Confidence: `high`, `medium`, or `low`.
8. Recoverable error or retry guidance when relevant.

## Error Handling

- If the template cannot be found or the match is ambiguous, return `failed` with the candidates and make no change.
- If the target file name already exists, return `failed` with the conflicting file identity and make no change.
- If the copy succeeds but the provisioned file fails to parse, report the failure stage and name the orphaned copy's identity for manual review; do not delete it without explicit confirmation and write no projects-list row.
- If draft validation cannot be repaired to a passing state, stop before commit, report the validation issues, and leave the copied file unchanged.
- If commit reports an ETag or concurrency conflict, stop and ask the user to refresh rather than overwriting newer content.
- If identity is insufficient for reliable row matching, return `failed` with the missing identity fields and make no SharePoint list change.
