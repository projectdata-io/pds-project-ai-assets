# Asset Authoring Rules

These rules apply when an AI agent creates or modifies content in this repository.

1. Treat the current PDS Project AI MCP tool contract as authoritative; do not invent tools, arguments, fields, or edit capabilities.
2. Keep assets platform-neutral unless they live in a clearly named platform-specific directory.
3. Prefer narrowly scoped skills, prompts, and agents over broad assistants that duplicate one another.
4. Every workflow that creates a parsing session must define cleanup behavior.
5. Read-only assets must not call edit or commit tools.
6. Editing assets must validate before commit. A clear user request authorizes the write; ask only when required inputs or targets are ambiguous.
7. Distinguish source values from calculated findings and state assumptions used in calculations.
8. Use stable identifiers such as task, resource, assignment, session, edit, and graph node IDs when presenting evidence.
9. Keep examples synthetic and free of secrets or personal data.
10. Do not expose unreleased capabilities, source paths, internal services, storage layouts, infrastructure identifiers, private operational limits, or production diagnostics.
11. Run `npm test` after changing repository assets or templates.

## Microsoft 365 Release Completion Gate

- Keep the repository authoritative. Bumping all agent versions together is allowed, but only release the agents explicitly in scope (currently Project Manager, Data Auditor, Plan Editor, and Schedule Generator for dev).
- Build and validate each release ZIP once; record its app ID, version, source commit (including any uncommitted changes), and SHA-256 checksum. Promote the same artifact unchanged.
- Synchronize the existing Developer Portal definition from that ZIP before catalog publication or Partner Center submission, preserving app identity. Stop if synchronization fails; an admin-center upload does not update Developer Portal.
- Verify app ID and version by reading both Developer Portal and the target catalog after publication. Upload/submission success alone is not release completion; report pending approval or verification.
- Retry only the failed stage using the same ZIP/version, without automatic bumping or regeneration. Never publish a stale portal export or delete duplicate app definitions without explicit approval.
- Follow the release synchronization procedure in [README.md](README.md#mandatory-release-synchronization).