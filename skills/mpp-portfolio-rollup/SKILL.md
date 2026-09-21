---
name: mpp-portfolio-rollup
description: "Roll up a Microsoft Project master plan and resolved child projects through PDS Project AI. Use for cross-project dates, milestones, progress, cost, resources, risks, and portfolio summaries."
argument-hint: "Provide a master MPP source or root session ID and the requested rollup measures"
---

# MPP Portfolio Rollup

## Use When

- The user wants consolidated reporting across a master project and resolved subprojects.
- The user asks for cross-project milestones, schedule exposure, cost, work, or resource concentration.

## Required MCP Capabilities

- Tools: `create_session_from_reference`, `create_session_from_onedrive`, `get_project`, `list_tasks`, `get_master_project_graph`, `get_master_project_node`, `list_master_project_node_entities`, `close_session`.
- Scope: `Session.ReadOnly`.

## Workflow

1. Reuse a supplied root session or create one authorized root session with caller-approved resolution mappings and bounds. Track ownership.
2. Query root tasks to identify inserted-project placeholders, then call `get_master_project_graph` once.
3. Record all node IDs, parent relationships, resolution states, and coverage limits. Analyze only resolved nodes.
4. Read each resolved node summary and retrieve bounded, completely paged node entities required by the requested measures.
5. Keep every value attributable to a node ID. Exclude root inserted-project placeholder tasks when child detail represents the same work.
6. Aggregate only compatible numeric fields and currencies. Exclude summary tasks when leaf-level aggregation would double-count them.
7. Report unresolved, failed, and bound-limited nodes as coverage gaps, not zero-value projects.
8. Close only a root session created by this skill.

## Guardrails

- Never fetch or parse child references independently.
- Never edit child nodes.
- Do not combine currencies, incompatible units, or different status dates silently.
- Do not claim full portfolio coverage when graph nodes are unresolved or truncated.
- Cite node IDs and entity UIDs.

## Output Format

Return graph coverage, project/node summary, cross-project dates and milestones, requested work/cost/resource rollups, highest risks, exclusions, unresolved nodes, and calculation notes.

## Error Handling

- For unresolved nodes, request authoritative source mappings rather than resolving paths independently.
- If measures are incompatible across nodes, report per-node values instead of a combined total.
- If the root expires, recreate the complete graph only with the original authorized inputs.

## Compatibility

Uses the current public PDS Project AI bounded master-project graph, read-only node entity, root project, and session tools.