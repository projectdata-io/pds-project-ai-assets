---
name: mpp-compliance-gate-check
description: "Evaluate an updated Microsoft Project MPP file against schedule quality gates and record a pass/fail verdict using the PDS Project AI MCP connector for extraction and the Work IQ SharePoint MCP connector for the gate-results upsert."
argument-hint: "Provide the MPP driveId/itemId or authorized HTTPS file reference and the configured SharePoint gate-results list identity"
---

# MPP Compliance Gate Check

## Use When

- A SharePoint or OneDrive file trigger reports that an MPP project file was created or updated.
- The plan must be evaluated against schedule quality gates before a baseline, status deadline, or publication step.

## Required MCP Capabilities

- Tools: `create_session_from_reference`, `create_session_from_onedrive`, `get_project`, `list_tasks`, `list_resources`, `list_assignments`, `close_session`.
- Work IQ SharePoint MCP connector capability: list item read, create, and update operations available to the configured agent connection.
- PDS Project AI scope: `Session.ReadOnly`.

## Workflow

1. Accept the file identity from the trigger: preferably SharePoint/OneDrive `driveId` and `itemId`, otherwise an authorized HTTPS reference plus file name.
2. Create one PDS Project AI session with `create_session_from_onedrive` for delegated Graph access or `create_session_from_reference` for an authorized HTTPS reference.
3. Call `get_project` for the project title and status date, and retrieve the complete task, resource, and assignment collections with `list_tasks`, `list_resources`, and `list_assignments`, following pagination to the end.
4. Evaluate every quality gate in the owning agent instructions against the extracted evidence, recording counts, thresholds, and worst-offender task UIDs.
5. Derive the overall verdict and upsert one gate-results row keyed by the stable file identity.
6. Close the PDS Project AI session after producing the result.
7. Return the verdict, per-gate results, cited evidence, row identity, confidence, and any recoverable warning.

## Guardrails

- Do not use the Work IQ SharePoint MCP connector outside the configured gate-results list.
- Do not create, update, or delete the source MPP file through either MCP server.
- Never evaluate from an incomplete collection; pagination must be exhausted before running the gates.
- Evaluate all gates even after a failure; never short-circuit.
- Cite counts, thresholds, and task UIDs for every failed gate; never fail a gate without evidence.
- Use `attention` when a gate's evidence is missing from the extraction rather than guessing pass or fail.
- Keep the evidence summary bounded; state the number of omitted items when truncating.
- Use the gate definitions and field mapping from the owning agent instructions. Do not maintain a separate gate set in this skill.

## Output Format

Return a concise operational result with:

1. Verdict: `passed`, `attention`, or `failed`.
2. Per-gate result with cited evidence for failures.
3. Source file identity used for matching.
4. SharePoint row identity when written.
5. Missing evidence or mapping gaps.
6. Confidence: `high`, `medium`, or `low`.
7. Recoverable error or retry guidance when relevant.

## Error Handling

- If the file cannot be opened or parsed, close any created PDS Project AI session, record a `failed` verdict row when the list mapping supports it, and return a structured `error` with retry-safe guidance.
- If pagination is incomplete, make no SharePoint change and return `failed` with the affected scope.
- If identity is insufficient for reliable row matching, return `failed` with the missing identity fields and make no SharePoint change.
