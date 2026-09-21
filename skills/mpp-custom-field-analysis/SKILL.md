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

1. Reuse a supplied session or create one authorized session and track ownership.
2. Call `list_attributes` with complete pagination to discover field IDs, names, aliases, types, and entity context.
3. Use `get_entity_schema` with `profile: "full"` for concrete custom-field properties supported on the target entity.
4. Resolve the requested field unambiguously. If aliases collide, present candidates and ask the user to choose.
5. Query only the target entities and required custom fields, retaining stable UIDs and names for evidence.
6. Group or summarize values only when types are compatible. Keep blank, null, zero, and false distinct.
7. Close only a session created by this skill.

## Guardrails

- Do not assume an alias uniquely identifies a field.
- Do not coerce text values into numbers or dates without an explicit schema type.
- Do not expose hidden personal or confidential field values beyond the user's request.
- Do not perform edits.

## Output Format

Return the resolved definition, entity coverage, value distribution or matching entities, unmapped values, entity UIDs, and interpretation caveats.

## Error Handling

- If no exact field match exists, list close public-schema candidates without guessing.
- If values are available only as raw extended attributes, identify them by field ID and declared type.
- Recreate expired sessions only from an available authorized source.

## Compatibility

Uses the current public PDS Project AI attribute definitions, full entity shapes, and session tools.