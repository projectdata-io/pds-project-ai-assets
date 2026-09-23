---
name: mpp-cross-project-dependency-check
description: "Evaluate every required cross-project dependency against the shared SharePoint dependency register and record a satisfaction report using the Work IQ SharePoint MCP connector for register reads and outcome rows."
argument-hint: "Provide the configured SharePoint dependency register and outcome list identities"
---

# MPP Cross-Project Dependency Check

## Use When

- A request asks which cross-project dependencies are broken, unsatisfied, or at risk across the registered plans.
- A scheduled or on-demand run should verify that every plan's external requirements are still met by a provider plan's milestones.

## Required MCP Capabilities

- Tools: none from the PDS Project AI MCP server are required for the check itself; the register already carries each plan's extracted declarations. Optionally `create_session_from_reference`, `create_session_from_onedrive`, `list_external_dependencies`, `close_session` to re-verify a specific suspect link against its source plan.
- Work IQ SharePoint MCP connector capability: list item read on the dependency register and item create on the outcome list, available to the configured agent connection.
- PDS Project AI scope: `Session.ReadOnly` (only when re-verifying a link at the source).

## Workflow

1. Accept the check run: the configured dependency register and outcome list identities.
2. Read all register rows for the configured scope through the Work IQ SharePoint MCP connector, following pagination to the end. Never evaluate against a partial register.
3. Group rows into `provides` and `requires` by declaration kind and plan file identity.
4. For every `requires` row, find a matching current `provides` row on the referenced provider milestone identity. Match on normalized provider file name plus provider task/milestone UID; do not match on the raw stored path, which can differ per machine.
5. Classify each requirement as `satisfied`, `unsatisfied` (no current matching provision), or `at-risk` (provision exists but is stale or its date moved later than the consumer's linked date), per the owning agent's register model.
6. Note register coverage: registered plans whose declarations are missing or stale, since those can hide broken links.
7. Create one outcome row summarizing the check with per-classification counts and a bounded list of broken or at-risk links citing both endpoint identities.
8. Return the overall status, counts, the broken and at-risk links, coverage gaps, confidence, and any recoverable warning.

## Guardrails

- Do not use the Work IQ SharePoint MCP connector outside the configured register and outcome lists.
- Never mark a requirement satisfied without a matching, current `provides` row.
- Never evaluate against an incompletely read register; pagination must be exhausted before classifying.
- Cite both the consumer (requirement) and provider (provision) identities for every reported broken or at-risk link.
- Do not infer cross-project links from task names, dates, or plan order; a link exists only through a declared reference.
- Report stale or missing declarations as coverage gaps rather than silently treating them as satisfied.
- Keep the outcome summary bounded; state the number of omitted links when truncating.
- Use the register model and field mapping from the owning agent instructions. Do not maintain a separate map in this skill.

## Output Format

Return a concise operational result with:

1. Overall status: `healthy`, `at-risk`, or `broken`.
2. Counts of `satisfied`, `unsatisfied`, and `at-risk` requirements.
3. Each unsatisfied or at-risk link with consumer and provider endpoint identities.
4. Register coverage gaps (stale or missing plan declarations).
5. Outcome row identity when written.
6. Confidence: `high`, `medium`, or `low`.
7. Recoverable error or retry guidance when relevant.

## Error Handling

- If the register cannot be read or pagination is incomplete, return `failed` with the affected scope and create no outcome row.
- If the configured scope has no registered plans, return `healthy` with zero counts and a coverage note rather than an error.
- If identity is insufficient to write the outcome row, return the findings in the response and report the mapping gap.
