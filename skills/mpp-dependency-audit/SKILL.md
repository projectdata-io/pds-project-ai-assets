---
name: mpp-dependency-audit
description: "Audit Microsoft Project task dependencies through PDS Project AI. Use for missing predecessors, dangling links, cycles, unusual relationship types, lag, and blocked handoffs."
argument-hint: "Provide an MPP source or session ID and optional task, milestone, or dependency scope"
---

# MPP Dependency Audit

## Use When

- The user asks whether task dependencies are complete, coherent, or creating schedule risk.
- The user wants dangling links, cycles, open handoffs, or excessive lag reviewed.

## Required MCP Capabilities

- Tools: `create_session_from_reference`, `create_session_from_onedrive`, `list_tasks`, `close_session`.
- Scope: `Session.ReadOnly`.

## Workflow

1. Reuse a supplied session or create one authorized session and track ownership.
2. Query every task page with `shapeProfile: "full"`, `top: 1000`, `orderBy: "id asc"`, `select: "uid,id,name,wbs,summary,active,milestone,start,finish,actualFinish,percentComplete,critical,totalSlack,externalTask,crossProject"`, and `expand: "predecessors"`.
3. Build a directed graph keyed by task `uid`. Preserve predecessor UID, successor UID, relationship type, and lag exactly as returned.
4. Check unresolved task references only after complete pagination. Detect self-links, duplicate links, cycles, and relationships involving inactive, external, or cross-project tasks.
5. Identify active non-summary tasks without predecessors or successors as review candidates, not automatic errors. Exclude the project summary and clearly terminal milestones where appropriate.
6. For incomplete successors, report unfinished predecessors and explicit handoff exposure. Do not infer links from dates or row order.
7. Rank findings by cycle presence, unresolved references, critical-path involvement, negative slack, and impact on requested milestones.
8. Close only a session created by this skill.

## Guardrails

- Do not declare every unlinked task defective; plans can contain intentional independent work.
- Do not decode numeric relationship types without a public mapping.
- Do not convert lag units unless the schema establishes their meaning.
- Distinguish internal, external, and cross-project dependency evidence.
- Cite every task and relationship by UID. Do not perform edits.

## Output Format

Return graph coverage, critical findings, cycles, unresolved or duplicate links, open predecessor handoffs, unlinked review candidates, and limitations. Include task UIDs, names, relationship type, lag, and relevant dates.

## Error Handling

- If predecessor expansion is unavailable, report that dependency integrity could not be audited.
- If a referenced UID is absent, confirm complete pagination before classifying it as unresolved.
- Recreate an expired session only from an available authorized source.

## Compatibility

Uses the current public PDS Project AI full task profile, predecessor expansion, and session tools.