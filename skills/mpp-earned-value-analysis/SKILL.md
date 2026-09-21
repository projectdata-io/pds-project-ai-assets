---
name: mpp-earned-value-analysis
description: "Analyze stored earned-value measures in a Microsoft Project MPP plan through PDS Project AI. Use for ACWP, BCWP, BCWS, CV, SV, CPI, SPI, and performance interpretation."
argument-hint: "Provide an MPP source or session ID and optional task, resource, or reporting scope"
---

# MPP Earned Value Analysis

## Use When

- The user asks about earned value, cost performance, schedule performance, CPI, SPI, CV, or SV.
- The user wants task, resource, or assignment performance ranked by earned-value evidence.

## Required MCP Capabilities

- Tools: `create_session_from_reference`, `create_session_from_onedrive`, `get_entity_schema`, `get_project`, `list_tasks`, `list_resources`, `list_assignments`, `close_session`.
- Scope: `Session.ReadOnly`.

## Workflow

1. Reuse a supplied session or create one authorized session and track ownership.
2. Establish the project status date and requested entity scope.
3. Use `get_entity_schema` with `profile: "full"` to verify available earned-value fields.
4. Query all relevant pages. Select stable UIDs, names through direct fields or relationships, `acwp`, `bcwp`, `bcws`, `cv`, `sv`, `vac`, baseline values, and progress fields where supported.
5. Report stored `CV` and `SV` as source facts. Calculate only when inputs are numeric and compatible:
   - `CPI = BCWP / ACWP` when `ACWP` is nonzero;
   - `SPI = BCWP / BCWS` when `BCWS` is nonzero;
   - calculated `CV = BCWP - ACWP`;
   - calculated `SV = BCWP - BCWS`.
6. Do not sum summary tasks with descendants. Do not aggregate across currencies or incompatible units.
7. Compare calculated values with stored values and disclose material discrepancies instead of choosing one silently.
8. Close only a session created by this skill.

## Guardrails

- Do not derive earned value from percent complete alone.
- Do not call a missing value zero or divide by zero.
- Do not interpret SPI as calendar-day slippage.
- State whether each measure is stored or calculated and identify entities by UID.
- Do not forecast EAC or ETC unless the user specifies the formula and required inputs exist.
- Do not perform edits.

## Output Format

Return the status-date basis, data coverage, source measures, calculated CPI/SPI where valid, ranked exceptions, formula notes, and limitations. Avoid formal health colors unless thresholds are supplied.

## Error Handling

- If earned-value fields are absent, explain that the MPP plan does not provide enough evidence for the requested analysis.
- If values are nonnumeric or use incompatible units, report them without arithmetic.
- Recreate an expired session only from an available authorized source.

## Compatibility

Uses the current public PDS Project AI full-profile earned-value fields and project/session tools.