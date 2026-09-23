---
name: mpp-dependency-register-publish
description: "Publish a Microsoft Project MPP plan's provided milestones and required external dependencies to a shared SharePoint dependency register using the PDS Project AI MCP connector for extraction and the Work IQ SharePoint MCP connector for the upsert."
argument-hint: "Provide the MPP driveId/itemId or authorized HTTPS file reference and the configured SharePoint dependency register identity"
---

# MPP Dependency Register Publish

## Use When

- A SharePoint or OneDrive file trigger reports that a registered MPP plan was created or updated.
- The plan's cross-project declarations in the shared dependency register should be refreshed from its current content.

## Required MCP Capabilities

- Tools: `create_session_from_reference`, `create_session_from_onedrive`, `get_project`, `list_tasks`, `list_external_dependencies`, `close_session`.
- Work IQ SharePoint MCP connector capability: list item read, create, update, and delete on the configured dependency register, available to the configured agent connection.
- PDS Project AI scope: `Session.ReadOnly`.

## Workflow

1. Accept the plan identity from the trigger: preferably SharePoint/OneDrive `driveId` and `itemId`, otherwise an authorized HTTPS reference plus file name.
2. Open the plan with `create_session_from_onedrive` for delegated Graph access or `create_session_from_reference` for an authorized HTTPS reference.
3. Call `get_project` for the title and retrieve the complete task collection with `list_tasks`, following pagination to the end.
4. Call `list_external_dependencies` to get the evidence-backed cross-project edges, following pagination to the end. Each row carries `consumerTaskUid`, `consumerTaskName`, `providerTaskUid`, `providerFile`, `providerMilestoneHint`, `relationType`, `lag`, and `linkDate`.
5. Derive declarations: a `provides` row per milestone task, and a `requires` row per external-dependency edge, keyed by the edge's `providerFile` plus `providerTaskUid` — the provider identity is now recovered from the plan's own bytes, not declared manually.
6. Read the register's existing rows scoped to this plan's file identity. Upsert current declarations and remove this plan's rows that no longer appear in the extraction; never touch other plans' rows.
7. Close the PDS Project AI session after producing the result.
8. Return the counts of `provides` and `requires` declarations upserted and removed, confidence, and any recoverable warning.

## Guardrails

- Do not use the Work IQ SharePoint MCP connector outside the configured dependency register.
- Do not create, update, or delete the source MPP file through either MCP server.
- Never publish from an incomplete task collection; pagination must be exhausted before deriving declarations.
- Scope every write to the triggering plan's file identity; never modify or delete declarations belonging to other plans.
- Do not treat missing dates or referenced provider identities as empty strings when unknown; report them as `null` and include them in the result's missing values.
- Take the provider identity (`providerFile`, `providerTaskUid`) from `list_external_dependencies` output; never fabricate a reference. When an edge's `providerFile` is null (the source bytes did not carry a recoverable path), record the requirement with a null provider and flag it in missing values rather than guessing.
- Treat `providerFile` as a display/match string, not fetch authority. It may be an absolute, local, or sync-client path that differs per machine. Match providers on the normalized file name, not the full path.
- Use stable identifiers such as `driveId`, `itemId`, project title, task UID, and SharePoint item ID when present.
- Use the register field mapping from the owning agent instructions. Do not maintain a separate map in this skill.

## Output Format

Return a concise operational result with:

1. Counts of `provides` and `requires` declarations upserted and removed.
2. Source plan identity used as the scope.
3. Missing evidence or mapping gaps.
4. Confidence: `high`, `medium`, or `low`.
5. Recoverable error or retry guidance when relevant.

## Error Handling

- If the file cannot be opened or parsed, close any created session and return a structured `error` with retry-safe guidance; make no register change.
- If pagination is incomplete on either the task collection or the existing register rows, make no register change and return `failed` with the affected scope.
- If identity is insufficient to scope register rows to the plan, return `failed` with the missing identity fields and make no SharePoint change.
