---
name: mpp-baseline-variance
description: "Compare current Microsoft Project schedule, work, and cost values with saved baselines through PDS Project AI. Use for baseline variance, slippage, and plan-versus-current reviews."
argument-hint: "Provide an MPP source or session ID and the baseline or entities to compare"
---

# MPP Baseline Variance

## Use When

- The user asks how the current plan differs from its baseline.
- The user wants schedule, work, or cost variance by task, resource, or assignment.

## Required MCP Capabilities

- Tools: `create_session_from_reference`, `create_session_from_onedrive`, `get_entity_schema`, `get_project`, `list_tasks`, `list_resources`, `list_assignments`, `close_session`.
- Scope: `Session.ReadOnly`.

## Workflow

1. Reuse a supplied session or create one authorized session and track ownership.
2. Confirm the baseline requested. If several saved baselines exist and the user has not selected one, list available baseline names or numbers and ask which comparison to use.
3. Query all relevant entity pages with `shapeProfile: "full"`. For tasks, select `uid,id,name,wbs,summary,start,finish,work,cost,startVariance,finishVariance,workVariance,baselineWork,baselineCost` and expand `baselines`.
4. Query resources or assignments only when requested. Select stable UIDs, current schedule/work/cost values, explicit variance fields, and expand `baselines`.
5. Prefer source variance fields. Otherwise calculate current minus baseline only when both values are present, numeric, and expressed compatibly. For finish slippage, compare date-times directly and report elapsed calendar time unless a working-calendar calculation is explicitly available.
6. Exclude summary tasks from aggregate task variance totals that would double-count children.
7. Close only a session created by this skill.

## Guardrails

- Never treat a missing baseline as zero.
- Do not combine different baseline numbers in one comparison.
- Label source variance and calculated variance separately.
- Do not convert work or duration units unless the schema provides an unambiguous conversion basis.
- Cite every finding by entity type and UID. Do not perform edits.

## Output Format

Return the selected baseline, coverage, largest schedule slippages, largest work/cost variances, favorable variances, and missing-baseline notes. State the formula and units for every calculated value.

## Error Handling

- If baseline expansion is unavailable, use explicit baseline and variance fields that the entity schema exposes.
- If comparable values are missing, report coverage rather than calculating a result.
- Recreate an expired session only from an available authorized source.

## Compatibility

Uses the current public PDS Project AI baseline expansions, variance fields, schema discovery, and session tools.