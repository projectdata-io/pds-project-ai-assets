---
name: mpp-plan-comparison
description: "Compare two Microsoft Project MPP plans through PDS Project AI. Use for version comparison, schedule drift, changed tasks, resource changes, and before-versus-after reviews."
argument-hint: "Provide two authorized MPP sources or session IDs and the comparison focus"
---

# MPP Plan Comparison

## Use When

- The user asks what changed between two MPP files or plan versions.
- The user wants task, resource, assignment, milestone, or project-date differences.

## Required MCP Capabilities

- Tools: `create_session_from_reference`, `create_session_from_onedrive`, `get_project`, `list_tasks`, `list_resources`, `list_assignments`, `close_session`.
- Scope: `Session.ReadOnly`.

## Workflow

1. Label the two plans as baseline comparison sides, not Microsoft Project saved baselines. Reuse supplied sessions or create one authorized session per source and track ownership independently.
2. Retrieve the same shape profile, selected fields, expansions, ordering, and complete pages from both sessions.
3. Match entities by stable GUID when present. Otherwise use UID only when the plans demonstrably share identity lineage. Treat name/WBS matching as tentative and report confidence.
4. Classify added, removed, changed, and unmatched entities. Compare project dates, task hierarchy and schedule, milestones, resources, assignments, work, cost, and progress only when requested.
5. Keep source-side values visible. Do not collapse null and zero or calculate incompatible differences.
6. Close each session only if this skill created it.

## Guardrails

- Never match entities solely because names are equal without labeling the match tentative.
- Do not call renames additions/deletions when stable identity proves continuity.
- Do not compare differently shaped or partially paged datasets silently.
- This workflow is read-only and does not merge plans.

## Output Format

Return source identities, matching method and confidence, project-level changes, added/removed/changed entities, largest schedule/work/cost differences, unmatched records, and limitations.

## Error Handling

- If one source fails, do not present a one-sided result as a comparison.
- If no reliable identity exists, provide separate unmatched candidate lists instead of forced matches.
- Close only successfully created, skill-owned sessions during cleanup.

## Compatibility

Uses the current public PDS Project AI project/entity retrieval and independent session lifecycle tools.