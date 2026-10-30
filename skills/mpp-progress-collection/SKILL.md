---
name: mpp-progress-collection
description: "Collect team-reported task progress from a configured SharePoint intake list, apply the batch to the source MPP file through PDS Project AI, and record per-submission outcomes through the Work IQ SharePoint MCP connector."
argument-hint: "Provide the source MPP driveId/itemId or authorized reference and the configured SharePoint intake and outcome list identities"
---

# MPP Progress Collection

## Use When

- Team members have reported task progress into a configured SharePoint intake list and the source plan should be updated in one batch.
- A request asks to apply pending progress submissions to a named MPP file.

## Required MCP Capabilities

- Tools: `create_session_from_reference`, `create_session_from_onedrive`, `list_tasks`, `close_session`. Draft staging is delegated to `mpp-progress-editor`; commit orchestration is delegated to `mpp-safe-commit`, which carry the edit capability tools.
- Work IQ SharePoint MCP connector capability: list item read and update on the configured intake list, and item read and create on the configured outcome list, available to the configured agent connection.
- PDS Project AI scope: `Session.ReadWrite` (required for draft and commit; read tools run under the same session).

## Workflow

1. Accept the source MPP identity and configured intake/outcome list identities. Resolve an authorized source-file overwrite target before staging: provider, mode, driveId, and itemId for OneDrive/SharePoint. An HTTPS read reference alone is not write-back authority; ask for the writable source target when missing.
2. Read all pending submissions from the intake list through the Work IQ SharePoint MCP connector, following pagination to the end.
3. Open the source file with `create_session_from_onedrive` or `create_session_from_reference` and retrieve the complete task collection with `list_tasks`, following pagination to the end.
4. Match each submission to exactly one task UID. Reject ambiguous or unmatched submissions individually rather than guessing. For conflicting values on the same task field, use an explicit configured resolution rule or reject the conflicting submissions; never invent last-write-wins ordering.
5. Pass the same verified `sessionId`, matched updates, and ownership context to `mpp-progress-editor`. It returns the staged `editId` and validation result. Exclude individually invalid submissions and record their reasons. The collector retains cleanup responsibility; delegated workflows must keep the session open through outcome reconciliation.
6. Pass that same `sessionId`, validated `editId`, and source overwrite target to `mpp-safe-commit`, preserving one idempotency key. Require successful provider write-back, not merely a session-only commit. Stop on an ETag or concurrency conflict.
7. After source write-back succeeds, write one outcome row per processed submission and update intake statuses (`applied`, `rejected`, or `skipped`). Match existing outcomes by configured submission identity before retrying list writes. Keep the session open until reconciliation is complete, then close it only if this workflow created it.
8. Return the action taken, per-status counts, committed task UIDs, outcome row identity, confidence, and any recoverable warning.

## Guardrails

- Do not use the Work IQ SharePoint MCP connector outside the configured intake and outcome lists.
- Do not edit any MPP file other than the named source.
- Never stage a submission whose task cannot be uniquely matched; never invent progress values, actual dates, or identifiers.
- Stage the batch as a single draft; do not commit per submission.
- Never commit an unvalidated draft. Do not ask the user to approve the collection request a second time.
- Use one stable idempotency key per logical commit and preserve it across retries. Do not retry with a new key.
- Never mark a submission applied before source-file write-back succeeds. A session-only commit is not an update to the source file.
- Never delete intake submissions.
- Keep the result concise; cite task UIDs and rejection reasons without embedding full task collections.
- Use the intake and outcome field mapping from the owning agent instructions. Do not maintain a separate map in this skill.

## Output Format

Return a concise operational result with:

1. Action taken: `committed`, `no-updates`, or `failed`.
2. Counts of `applied`, `rejected`, and `skipped` submissions.
3. Committed task UIDs and applied fields.
4. Rejection reasons per rejected submission.
5. Outcome row identity when written.
6. Confidence: `high`, `medium`, or `low`.
7. Recoverable error or retry guidance when relevant.

## Error Handling

- If the source file cannot be opened or parsed, close any created session and return `failed`; make no list change.
- If pagination is incomplete on the intake list or the task collection, return `failed` with the affected scope and make no change.
- If draft validation cannot be repaired to a passing state, stop before commit, report the validation issues, and leave the source file unchanged; mark excluded submissions `rejected` with reasons.
- If commit reports an ETag or concurrency conflict, stop and ask the user to refresh rather than overwriting newer content; leave submission statuses unchanged.
- If identity is insufficient for reliable submission matching, return `failed` with the missing identity fields and make no SharePoint change.
- If provider write-back succeeded but outcome/status writes failed, report partial reconciliation and retry only those list writes. Do not create a new draft or replay the MPP commit; preserve the confirmed commit and submission identities.
