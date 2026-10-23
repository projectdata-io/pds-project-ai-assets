# PDS Project AI: MPP Data Auditor

This is one independently deployable Microsoft 365 declarative-agent package. It contains exactly one Teams manifest declarative-agent entry, its own Teams app lifecycle, and the package-local `MCP_DA_AUTH_ID_MPP_DATA_AUDITOR` binding. No Work IQ actions or report-storage OAuth connections are included.

The package uses native read-only capabilities to search the signed-in user's accessible SharePoint and OneDrive files, email, and Teams conversations for relevant project context. It also uses a role-specific variant of the shared User UI icon, the PDS MCP endpoint, and the MCP Apps project-plan picker. PDS MCP tools use wildcard dynamic discovery without static tool definitions. Instructions prohibit project-data changes; these instructions are not an authorization boundary. OAuth scopes and server-side authorization determine executable access, and discovered tools may include write operations. Code Interpreter generates requested Word, PDF, Excel, and PowerPoint reports as temporary downloadable attachments. Users save downloaded reports to OneDrive or SharePoint manually; the agent does not upload reports.

## Generate and Validate

Run `npm run generate` and `npm run validate` from this directory. These commands only regenerate and structurally validate local source artifacts; they do not provision, deploy, publish, install, or alter tenant resources.

## Development Lifecycle

Keep `env/.env.*` local and package-specific. Do not copy `TEAMS_APP_ID` or `MCP_DA_AUTH_ID_MPP_DATA_AUDITOR` from another package. From the asset repository, use the [batch lifecycle runbook](../../README.md#development-provisioning-and-organization-submission) to dry-run, provision in a non-production tenant, personally install the dev package, test, then choose tenant-wide sharing or submission for admin review. Tenant sharing grants access but does not preinstall; administrators can optionally preinstall after approval. The coordinator requires `--execute` for tenant changes. Do not run `all --env dev --execute` if testing must happen between provisioning and submission.

## Migration

This package replaces one role from the retired invalid multi-agent suite. Install it as its own Microsoft 365 app. It does not reuse the retired suite's generated Teams app ID or DCR identifier.
