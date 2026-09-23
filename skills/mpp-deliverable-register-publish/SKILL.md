---
name: mpp-deliverable-register-publish
description: "Publish a Microsoft Project MPP plan's declared deliverable keys, read from a configured custom field, to a shared SharePoint deliverable register using the PDS Project AI MCP connector for extraction and the Work IQ SharePoint MCP connector for the upsert. Independent of Project Server/Online-only native deliverable fields."
argument-hint: "Provide the MPP driveId/itemId or authorized HTTPS file reference, the configured SharePoint deliverable register identity, and the configured deliverable-key custom field"
---

# MPP Deliverable Register Publish

## Use When

- A SharePoint or OneDrive file trigger reports that a registered MPP plan was created or updated.
- The plan's declared deliverable-key links in the shared deliverable register should be refreshed from its current content.

## Do Not Use When

- The request is about evidence-backed cross-project task links recovered from the plan's own bytes. Use `mpp-dependency-register-publish` instead.

## Required MCP Capabilities

- Tools: `create_session_from_reference`, `create_session_from_onedrive`, `get_project`, `list_tasks`, `list_attributes`, `close_session`.
- Work IQ SharePoint MCP connector capability: list item read, create, update, and delete on the configured deliverable register, available to the configured agent connection.
- PDS Project AI scope: `Session.ReadOnly`.

## Workflow

1. Accept the plan identity from the trigger: preferably SharePoint/OneDrive `driveId` and `itemId`, otherwise an authorized HTTPS reference plus file name.
2. Open the plan with `create_session_from_onedrive` for delegated Graph access or `create_session_from_reference` for an authorized HTTPS reference.
3. Call `list_attributes` to confirm the configured deliverable-key custom field ID/alias resolves on this plan. If it does not resolve, stop, publish no declarations, and report the gap.
4. Call `get_project` for the title and retrieve the complete task collection with `list_tasks`, including the configured deliverable-key field in `$select`, following pagination to the end.
5. For every task where the configured field has a non-empty value, create one `deliverable-provides` row or one `deliverable-requires` row per the caller's declared convention for that task, keyed by the exact field value.
6. Never derive a deliverable key from task name, WBS, notes, or any native `commitmentType`/`isPublished`/deliverable GUID field; those are Project Server/Online-dependent and out of scope.
7. Read the register's existing rows scoped to this plan's file identity. Upsert current declarations and remove this plan's rows that no longer appear in the extraction; never touch other plans' rows.
8. Close the PDS Project AI session after producing the result.
9. Return the counts of `deliverable-provides` and `deliverable-requires` declarations upserted and removed, whether the configured field resolved, confidence, and any recoverable warning.

## Guardrails

- Do not use the Work IQ SharePoint MCP connector outside the configured deliverable register.
- Do not create, update, or delete the source MPP file through either MCP server.
- Never publish from an incomplete task collection; pagination must be exhausted before deriving declarations.
- Scope every write to the triggering plan's file identity; never modify or delete declarations belonging to other plans.
- Take the deliverable key only from the configured custom field's literal value. Never normalize, truncate meaning from, or fuzzy-adjust the key at publish time; publish it exactly as stored.
- If the configured field cannot be resolved via `list_attributes`, publish no rows for this plan and report the gap; never fall back to a different field.
- Do not treat a missing deliverable key as an empty string; skip the task rather than publishing an empty-key row.
- Use stable identifiers such as `driveId`, `itemId`, project title, task UID, and SharePoint item ID when present.
- Use the register field mapping from the owning agent instructions. Do not maintain a separate map in this skill.

## Output Format

Return a concise operational result with:

1. Counts of `deliverable-provides` and `deliverable-requires` declarations upserted and removed.
2. Whether the configured deliverable-key field resolved on this plan.
3. Source plan identity used as the scope.
4. Missing evidence or mapping gaps.
5. Confidence: `high`, `medium`, or `low`.
6. Recoverable error or retry guidance when relevant.

## Error Handling

- If the file cannot be opened or parsed, close any created session and return a structured `error` with retry-safe guidance; make no register change.
- If the configured deliverable-key field does not resolve via `list_attributes`, publish no declarations and report the field-resolution gap.
- If pagination is incomplete on either the task collection or the existing register rows, make no register change and return `failed` with the affected scope.
- If identity is insufficient to scope register rows to the plan, return `failed` with the missing identity fields and make no SharePoint change.
