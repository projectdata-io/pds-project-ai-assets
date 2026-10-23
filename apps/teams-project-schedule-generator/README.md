# PDS Project AI: Project Schedule Generator

This is an independently deployable Microsoft 365 declarative-agent package for project-plan editing. PDS MCP tools are discovered dynamically without a package tool allowlist. Role instructions govern intended use; OAuth scopes and server authorization enforce access. Native read-only capabilities search the user's accessible SharePoint and OneDrive files, email, and Teams conversations; no Work IQ actions are included.

The agent executes clear edit requests end-to-end, asks only for missing or ambiguous inputs, and reports persistence only after commit succeeds.

## Development Lifecycle

Keep package-local env/.env.* files local and package-specific. Configure the package's Teams app ID and DCR binding in env/.env.dev. From the asset repository, use the batch lifecycle runbook in the root README to provision in a non-production tenant, personally install the package, test requested edits, then choose submission for admin review. The coordinator requires --execute for tenant changes. Do not run all --env dev --execute when testing must happen between provisioning and submission.
