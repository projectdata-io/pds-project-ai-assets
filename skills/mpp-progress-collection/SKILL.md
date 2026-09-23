---
name: mpp-progress-collection
description: "Collect team-reported task progress from a configured SharePoint intake list, stage the batch on the source MPP file through the guarded PDS Project AI draft lifecycle, and record per-submission outcomes through the Work IQ SharePoint MCP connector."
argument-hint: "Provide the source MPP driveId/itemId or authorized reference and the configured SharePoint intake and outcome list identities"
---

# MPP Progress Collection

## Use When

- Team members have reported task progress into a configured SharePoint intake list and the source plan should be updated in one confirmed batch.
- A request asks to apply pending progress submissions to a named MPP file.

## Required MCP Capabilities

- Tools: `create_session_from_reference`, `create_session_from_onedrive`, `list_tasks`, `close_session`. Draft staging is delegated to `mpp-progress-editor`; commit orchestration is delegated to `mpp-safe-commit`, which carry the edit capability tools.
- Work IQ SharePoint MCP connector capability: list item read and update on the configured intake list, and item create on the configured outcome list, available to the configured agent connection.
- PDS Project AI scope: `Session.ReadWrite` (required for draft and commit; read tools run under the same session).

## Workflow

1. Accept the collection request: the source MPP identity and the configured intake and outcome list identities.
2. Read all pending submissions from the intake list through the Work IQ SharePoint MCP connector, following pagination to the end.
3. Open the source file with `create_session_from_onedrive` or `create_session_from_reference` and retrieve the complete task collection with `list_tasks`, following pagination to the end.
4. Match each submission to exactly one task UID. Reject ambiguous or unmatched submissions individually rather than guessing.
5. Hand the verified session and the matched update set to `mpp-progress-editor`, which stages the complete batch in one draft, previews, and validates. Exclude individually invalid submissions and record their reasons.
6. Present the batch preview, validation status, destination, and overwrite consequence, and obtain explicit confirmation of that exact draft.
7. Commit through `mpp-safe-commit` with one stable idempotency key. Stop on an ETag or concurrency conflict.
8. After the commit result is known, write one outcome row per processed submission to the outcome list and update each submission's status in the intake list (`applied`, `rejected`, or `skipped`). Close the PDS Project AI session.
9. Return the action taken, per-status counts, committed task UIDs, outcome row identity, confidence, and any recoverable warning.

## Guardrails

- Do not use the Work IQ SharePoint MCP connector outside the configured intake and outcome lists.
- Do not edit any MPP file other than the named source.
- Never stage a submission whose task cannot be uniquely matched; never invent progress values, actual dates, or identifiers.
- Stage the batch as a single draft; do not commit per submission.
- Never commit an unpreviewed, invalid, or changed-since-confirmation draft. Confirmation must follow preview and validation.
- Use one stable idempotency key per logical commit and preserve it across retries. Do not retry with a new key.
- Update submission statuses only after the commit result is known; never mark a submission applied before commit succeeds.
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
