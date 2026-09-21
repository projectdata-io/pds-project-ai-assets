---
name: mpp-master-project-navigation
description: "Navigate and analyze a Microsoft Project master-project graph through PDS Project AI. Use for inserted subprojects, consolidated plans, child-project status, and cross-project rollups."
argument-hint: "Provide a master MPP source or session ID and the nodes or rollup question"
---

# MPP Master Project Navigation

## Use When

- The root plan contains inserted subprojects or the user asks about a consolidated master plan.
- The user wants read-only child-project details or a cross-project rollup.

## Required MCP Capabilities

- Tools: `create_session_from_reference`, `create_session_from_onedrive`, `list_tasks`, `get_master_project_graph`, `get_master_project_node`, `list_master_project_node_entities`, `close_session`.
- Scope: `Session.ReadOnly`.

## Workflow

1. Reuse a supplied root session or create one authorized root session. For OneDrive/SharePoint, use caller-authorized mappings and bounded resolution options supplied by the user or host.
2. Query root tasks for `uid,id,name,isSubproject,isSubprojectReadOnly,subprojectFile,externalTask,crossProject` to establish whether graph navigation is relevant.
3. Call `get_master_project_graph` once. Record each node ID, parent relationship, source reference, resolution status, and reported failure without rewriting source references.
4. Use `get_master_project_node` for child project summaries. Use `list_master_project_node_entities` for bounded task, resource, assignment, calendar, or attribute questions; always set `top`, `select`, and deterministic `orderBy` where supported.
5. Traverse only resolved nodes and respect the returned graph. Do not create independent child sessions or fetch parser-reported paths directly.
6. For rollups, keep root and child values attributable to node ID. Avoid double-counting inserted-project placeholder tasks and child-project detail.
7. Close the root session only when this skill created it; root cleanup also owns its graph artifacts.

## Guardrails

- Treat child graph nodes as read-only.
- Never interpret `subprojectFile` as fetch authority or rewrite absolute, local, traversal, or cross-drive paths.
- Do not repeatedly rebuild the root session to resolve individual nodes.
- Do not claim complete portfolio coverage when nodes are unresolved, limited by depth/project bounds, or inaccessible.
- Cite node IDs and entity UIDs in findings. Do not perform edits on child nodes.

## Output Format

Return graph coverage, node status table, requested node details or rollup, unresolved references, double-counting exclusions, and data limitations. Keep every aggregate traceable to node IDs.

## Error Handling

- For unresolved references, report the exact logical reference and request an authoritative `fileUrl` or `driveId`/`itemId` mapping; do not resolve it independently.
- If the root session expires, recreate the complete graph only with the original authorized source and mappings.
- If a node is unresolved or failed, do not call node entity tools for it.

## Compatibility

Uses the current public PDS Project AI bounded master-project graph and read-only node tools.