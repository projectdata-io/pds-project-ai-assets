# Asset Authoring Rules

These rules apply when an AI agent creates or modifies content in this repository.

1. Treat the current PDS Project AI MCP tool contract as authoritative; do not invent tools, arguments, fields, or edit capabilities.
2. Keep assets platform-neutral unless they live in a clearly named platform-specific directory.
3. Prefer narrowly scoped skills, prompts, and agents over broad assistants that duplicate one another.
4. Every workflow that creates a parsing session must define cleanup behavior.
5. Read-only assets must not call edit or commit tools.
6. Editing assets must require preview and validation before commit, and must request confirmation before an externally visible write.
7. Distinguish source values from calculated findings and state assumptions used in calculations.
8. Use stable identifiers such as task, resource, assignment, session, edit, and graph node IDs when presenting evidence.
9. Keep examples synthetic and free of secrets or personal data.
10. Do not expose unreleased capabilities, source paths, internal services, storage layouts, infrastructure identifiers, private operational limits, or production diagnostics.
11. Run `npm test` after changing repository assets or templates.