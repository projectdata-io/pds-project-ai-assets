---
name: mpp-deliverable-link-check
description: "Evaluate every required soft deliverable-key link against the shared SharePoint deliverable register, detect status changes since the previous check, and record a satisfaction report using the Work IQ SharePoint MCP connector for register reads and outcome rows. Notification delivery to a project manager is a caller-configured downstream step, not performed by this skill."
argument-hint: "Provide the configured SharePoint deliverable register and outcome list identities"
---

# MPP Deliverable Link Check

## Use When

- A request asks which declared deliverable-key dependencies are broken, unsatisfied, or at risk across the registered plans.
- A scheduled or on-demand run should verify that every plan's declared deliverable requirements are still matched by a providing plan's declaration, and surface which ones changed since the previous run.

## Do Not Use When

- The request is about evidence-backed cross-project task links. Use `mpp-cross-project-dependency-check` instead.

## Required MCP Capabilities

- Tools: none from the PDS Project AI MCP server; the register already carries each plan's declared deliverable keys.
- Work IQ SharePoint MCP connector capability: list item read on the deliverable register and item create on the outcome list, available to the configured agent connection.
- PDS Project AI scope: not required for this skill.

## Workflow

1. Accept the check run: the configured deliverable register and outcome list identities.
2. Read all register rows for the configured scope through the Work IQ SharePoint MCP connector, following pagination to the end. Never evaluate against a partial register.
3. Read the most recent prior outcome row(s) for the configured scope to recover each requirement's last-known classification, keyed by consuming plan file identity + deliverable key.
4. Group register rows into `deliverable-provides` and `deliverable-requires` by plan file identity.
5. For every `deliverable-requires` row, find a matching current `deliverable-provides` row with the exact same deliverable key string, matched case-sensitively with no normalization or fuzzy matching.
6. Classify each requirement as `satisfied`, `unsatisfied` (no current matching provision), or `at-risk` (provision exists but is stale or its date moved later than the consumer's linked date), per the owning agent's register model.
7. Compare each requirement's new classification to its previous classification from step 3. Mark `changed: true` when they differ or the requirement is newly seen; otherwise `changed: false`.
8. Note register coverage: registered plans whose declarations are missing, stale, or blocked by an unresolved custom field, since those can hide broken links.
9. Create one outcome row summarizing the check with per-classification counts, the full list of `changed: true` requirements (each with consuming plan identity, deliverable key, previous classification, and new classification), and a bounded list of broken or at-risk links citing both sides' deliverable key and plan identity.
10. Return the overall status, counts, the changed requirements with their consuming plan identity, the broken and at-risk links, coverage gaps, confidence, and any recoverable warning. State that delivering this information to a project manager depends on the caller's own SharePoint alert or flow on the outcome list.

## Guardrails

- Do not use the Work IQ SharePoint MCP connector outside the configured register and outcome lists.
- Never mark a requirement satisfied without a matching, current `deliverable-provides` row with the exact same key.
- Never evaluate against an incompletely read register; pagination must be exhausted before classifying.
- Cite both sides' deliverable key and plan identity for every reported broken, at-risk, or changed link.
- Never fuzzy-match, normalize, or partially match a deliverable key; an exact string match is required or the requirement is `unsatisfied`.
- Report a satisfied soft link's confidence as bounded by the declared convention: it confirms two plans share a key, not a structural dependency verified in either file.
- Report stale, missing, or field-unresolved declarations as coverage gaps rather than silently treating them as satisfied.
- Base the `changed` flag only on a comparison against the most recent prior outcome row; never guess a previous state when no prior outcome exists (treat it as newly seen, `changed: true`).
- Never send a notification, email, Teams message, or alert directly. This skill only marks and reports which requirements changed; delivering that to a person is the caller's configured SharePoint alert or Power Automate flow on the outcome list.
- Keep the outcome summary bounded; state the number of omitted links when truncating.
- Use the register model and field mapping from the owning agent instructions. Do not maintain a separate map in this skill.

## Output Format

Return a concise operational result with:

1. Overall status: `healthy`, `at-risk`, or `broken`.
2. Counts of `satisfied`, `unsatisfied`, and `at-risk` requirements.
3. Requirements that changed status since the previous check, each with consuming plan identity, deliverable key, previous classification, and new classification.
4. Each unsatisfied or at-risk link with both sides' deliverable key and plan identity.
5. Register coverage gaps (stale, missing, or field-unresolved plan declarations).
6. Outcome row identity when written.
7. Confidence: `high`, `medium`, or `low`.
8. Recoverable error or retry guidance when relevant.
9. A note that project-manager notification depends on the caller's configured downstream delivery, not this skill.

## Error Handling

- If the register cannot be read or pagination is incomplete, return `failed` with the affected scope and create no outcome row.
- If the configured scope has no registered plans, return `healthy` with zero counts and a coverage note rather than an error.
- If identity is insufficient to write the outcome row, return the findings in the response and report the mapping gap.
