---
name: skill-name
description: "Describe what this skill accomplishes and the user requests that should trigger it."
argument-hint: "Describe the project question or desired outcome"
---

# Skill Title

## Use When

- Describe recognizable user intents.

## Do Not Use When

- Describe adjacent workflows owned by another asset.

## Required MCP Capabilities

- Tools: list exact tool names.
- Scopes: list required scopes.

## Workflow

1. Confirm the source and intended outcome.
2. Create or reuse one parsing session.
3. Retrieve only the fields and relationships needed.
4. Produce the defined output with entity identifiers as evidence.
5. Close a session created by this workflow.

## Guardrails

- Do not invent missing values.
- Distinguish source data from calculated conclusions.
- Do not perform edits unless this skill explicitly owns an editing workflow.

## Output Format

Define the required headings, fields, ordering, and evidence format.

## Error Handling

Define behavior for authentication, invalid files, quota limits, expired sessions, and incomplete data.

## Compatibility

List the MCP tools and product contract version on which this skill depends.