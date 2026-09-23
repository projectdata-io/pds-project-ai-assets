---
name: mpp-project-intake-triage
description: "Profile a newly added Microsoft Project MPP file and record a rule-based triage classification in a configured SharePoint intake list using the PDS Project AI MCP connector for extraction and the Work IQ SharePoint MCP connector for the upsert."
argument-hint: "Provide the MPP driveId/itemId or authorized HTTPS file reference and the configured SharePoint intake list identity"
---

# MPP Project Intake Triage

## Use When

- A SharePoint or OneDrive file trigger reports that a new MPP project file was added.
- The configured SharePoint intake list should gain or refresh a triage row for that file based on evidence extracted from the MPP.

## Required MCP Capabilities

- Tools: `create_session_from_reference`, `create_session_from_onedrive`, `get_project`, `list_tasks`, `list_resources`, `list_assignments`, `close_session`.
- Work IQ SharePoint MCP connector capability: list item read, create, and update operations available to the configured agent connection.
- PDS Project AI scope: `Session.ReadOnly`.

## Workflow

1. Accept the file identity from the trigger: preferably SharePoint/OneDrive `driveId` and `itemId`, otherwise an authorized HTTPS reference plus file name.
2. Create one PDS Project AI session with `create_session_from_onedrive` for delegated Graph access or `create_session_from_reference` for an authorized HTTPS reference.
3. Call `get_project` for the project title and retrieve the complete task, resource, and assignment collections with `list_tasks`, `list_resources`, and `list_assignments`, following pagination to the end.
4. Assemble the intake profile and apply the classification rules in the owning agent instructions, using only extracted evidence.
5. Read the configured SharePoint intake list row by stable file identity. Create the row when absent and the target mapping is known; update it when the file was re-triaged.
6. Close the PDS Project AI session after producing the result.
7. Return the classification, profile counts, item identity, missing values, confidence, and any recoverable warning.

## Guardrails

- Do not use the Work IQ SharePoint MCP connector outside the configured intake list.
- Do not create, update, or delete the source MPP file through either MCP server.
- Never write a triage row from an incomplete collection; pagination must be exhausted before classifying.
- Do not treat missing dates, counts, or titles as empty strings when they are unknown; report them as `null` and include them in the result's missing values.
- Classify conservatively when evidence is missing: prefer `attention` over guessing a healthier classification.
- Use stable identifiers such as `driveId`, `itemId`, project title, and SharePoint item ID when present.
- Keep the result concise; do not embed full project collections.
- Use the intake field mapping and classification rules from the owning agent instructions. Do not maintain a separate map in this skill.

## Output Format

Return a concise operational result with:

1. Classification assigned: `attention`, `oversized`, `incomplete`, or `standard`.
2. Source file identity used for matching.
3. SharePoint list item identity when available.
4. Extracted profile: task, milestone, resource, and assignment counts plus summary dates.
5. Missing evidence or mapping gaps.
6. Confidence: `high`, `medium`, or `low`.
7. Recoverable error or retry guidance when relevant.

## Error Handling

- If the file cannot be opened or parsed, close any created PDS Project AI session, record a `failed` triage row when the list mapping supports it, and return a structured `error` with retry-safe guidance.
- If pagination is incomplete, make no SharePoint change and return `failed` with the affected scope.
- If identity is insufficient for reliable row matching, return `failed` with the missing identity fields and make no SharePoint change.
