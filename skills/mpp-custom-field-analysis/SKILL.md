---
name: mpp-custom-field-analysis
description: "Discover and analyze Microsoft Project custom fields through PDS Project AI. Use for extended attributes, aliases, outline codes, flags, text, number, date, cost, and duration fields."
argument-hint: "Provide an MPP source or session ID and the custom field or business question"
---

# MPP Custom Field Analysis

## Use When

- The user asks what custom fields exist or how custom values classify tasks and resources.
- The user refers to a field by alias, display name, field ID, or local custom-field family.

## Required MCP Capabilities

- Tools: `create_session_from_reference`, `create_session_from_onedrive`, `get_entity_schema`, `get_project`, `list_attributes`, `list_tasks`, `list_resources`, `close_session`.
- Scope: `Session.ReadOnly`.

## Workflow

1. Reuse a supplied session or create one authorized session and track ownership. Complete the workflow synchronously with MCP calls in the current turn; do not start or claim a separate background task unless a real task tool returns a task ID and result.
2. Call `list_attributes` and follow every `nextSkipToken` until it is null. Reconcile the collected definitions with `count`.
3. Keep definitions (field IDs, names, aliases, types, and entity context) separate from values stored on tasks or resources. If the user asks only which fields are defined, answer from the complete `list_attributes` result; do not call unrelated project summaries or entity collections.
4. Use `get_entity_schema` with `profile: "full"` only when concrete custom-field properties for a relevant entity are needed. If stored values are requested, query only the relevant task or resource entities with `extendedAttributes` and complete pagination.
5. Resolve the requested field unambiguously. If aliases collide, present candidates and ask the user to choose.
6. Group or summarize values only when types are compatible. Keep blank, null, zero, and false distinct.
7. Close only a session created by this skill.

## Guardrails

- Do not assume an alias uniquely identifies a field.
- Do not coerce text values into numbers or dates without an explicit schema type.
- Do not expose hidden personal or confidential field values beyond the user's request.
- For a definitions inventory, output a `Field` / `Type` table. Never use `cfType` as a heading or show numeric codes; translate them using the mapping below. Treat null, empty, and missing metadata as unavailable: omit those properties entirely. Never print null-property inventories or definition-level `value` fields. Never say `Not reported`.
- Keep field IDs, GUIDs, secondary PIDs, numeric type codes, `userDef`, and `maxMultiValues` out of responses unless the user explicitly requests technical diagnostics. Never call a field `custom field, unnamed` or `not exposed`.
- If both alias and `fieldName` are absent, use `Unaliased <type> field N` when the human-readable type is known; otherwise use `Unaliased field N` and `Type not provided`. Number anonymous fields consistently within the result and note that the source has no display name. Do not invent business names.
- Do not perform edits.

## Output Format

Present a human-readable `Field` label using alias first, then `fieldName`, then a readable native name such as `Text3`. Show human-readable types, never numeric codes. Map `cfType`: 0 Cost/Currency, 1 Date, 2 Duration, 3 Finish (date), 4 Boolean, 5 Numeric, 6 Start (date), 7 Text. If absent or unknown, show `Type not provided` in the `Type` column; never expose the property name `cfType` or use `Not reported`.

Keep definitions separate from stored values. Do not infer values from definitions; report values only for relevant entities actually queried, and say `No value returned` only for queried rows returned without a value. Include entity coverage and interpretation caveats without exposing internal identifiers.

## Error Handling

- If no exact field match exists, list close public-schema candidates without guessing.
- If a raw extended attribute cannot be matched to a display name, use the unaliased fallback and human-readable type; disclose that the source name is unavailable. Show a field ID only when the user explicitly requests technical diagnostics.
- Recreate expired sessions only from an available authorized source.

## Compatibility

Uses the current public PDS Project AI attribute definitions, full entity shapes, and session tools.