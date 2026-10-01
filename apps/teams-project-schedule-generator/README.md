# PDS Project AI: Project Schedule Generator

This is an independently deployable Microsoft 365 declarative-agent package for guarded project-plan editing. The PDS MCP tool allowlist is derived from this role's mapped skills. Native read-only capabilities search the user's accessible SharePoint and OneDrive files, email, and Teams conversations; no Work IQ actions are included.

The agent may stage changes only for an explicit user request. It must preview and validate the complete draft, explain the exact operations and effects, and wait for confirmation of that exact validated draft before committing. It must not claim persistence until commit succeeds and the resulting artifact or provider destination is available.

## Development Lifecycle

Keep package-local env/.env.* files local and package-specific. Configure the package's Teams app ID and DCR binding in env/.env.dev. From the asset repository, use the batch lifecycle runbook in the root README to provision in a non-production tenant, personally install the package, test draft and confirmation behavior, then choose submission for admin review. The coordinator requires --execute for tenant changes. Do not run all --env dev --execute when testing must happen between provisioning and submission.
