---
name: mpp-resource-capacity
description: "Review Microsoft Project resource capacity through PDS Project AI. Use for overallocations, assignment load, availability, workload concentration, and resource bottlenecks."
argument-hint: "Provide an MPP source or session ID and optional resource or date focus"
---

# MPP Resource Capacity

## Use When

- The user asks who is overallocated, overloaded, underused, unavailable, or creating a delivery bottleneck.
- The user wants task assignments and workload concentration by resource.

## Do Not Use When

- The user asks to change assignment units or resources; this skill is read-only.
- The user wants only project-level cost reporting.

## Required MCP Capabilities

- Tools: `create_session_from_reference`, `create_session_from_onedrive`, `list_resources`, `list_assignments`, `list_tasks`, `close_session`.
- Scope: `Session.ReadOnly`.

## Workflow

1. Reuse a supplied session or create one authorized session and track ownership.
2. Query resources with `shapeProfile: "full"`, `top: 1000`, `orderBy: "id asc"`, and `select: "uid,id,name,active,isInactive,maxUnits,peakUnits,overAllocated,availableFrom,availableTo,start,finish,work,actualWork,remainingWork"`. Expand `availability` only when date-bounded capacity is requested.
3. Query assignments with `shapeProfile: "full"`, `top: 1000`, and `select: "uid,taskUid,resourceUid,units,work,actualWork,remainingWork,start,finish,overallocated"`.
4. Query task identifiers and names for cited assignments. Use `expand: "task,resource"` on assignments only if it is smaller than separate bounded lookups.
5. Page every queried collection. Join assignments by `resourceUid` and `taskUid`; never join by names.
6. Treat source `overAllocated` and assignment `overallocated` flags as direct evidence. Compare `units`, `maxUnits`, `peakUnits`, and availability only when their units and scales are compatible in the returned schema.
7. Rank resource concerns using direct over-allocation flags, overlapping assignment windows, remaining work, and concentration on critical tasks when critical-task data was explicitly retrieved.
8. Close only a session created by this skill.

## Guardrails

- Do not assume assignment `units` are fractions or percentages; retain source representation unless the schema establishes the scale.
- Do not infer daily utilization from aggregate work without timephased data.
- Do not label a resource underutilized when availability or calendar data is absent.
- Exclude inactive and null resources from ordinary capacity rankings, but report assignments against them as data-quality concerns.
- Cite resource and assignment UIDs for every finding.
- Do not perform edits.

## Output Format

1. **Capacity overview**: resource and assignment coverage plus applicable date range.
2. **Overallocated resources**: UID, resource, evidence, affected assignments, and dates.
3. **Workload concentrations**: resources carrying the largest compatible remaining-work totals or assignment counts.
4. **Availability conflicts**: only when availability periods support the finding.
5. **Data limitations**: missing calendars, timephased data, units, or partial pages.

## Error Handling

- If relationship expansion fails, retrieve resources, assignments, and tasks separately and join by UID.
- If units are ambiguous, report values as returned and avoid utilization percentages.
- Recreate expired sessions only from an available authorized source.

## Compatibility

Uses the current public PDS Project AI resource, assignment, task, schema, session-creation, and cleanup tools.