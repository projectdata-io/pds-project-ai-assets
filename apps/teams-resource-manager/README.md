# PDS Project AI: Resource Manager

This is one independently deployable Microsoft 365 declarative-agent package. It contains exactly one Teams manifest declarative-agent entry, its own Teams app lifecycle, the package-local `MCP_DA_AUTH_ID_RESOURCE_MANAGER` binding, and package-local Work IQ Word, OneDrive conversion, and report-storage auth bindings.

The package uses a role-specific variant of the shared User UI icon, the PDS MCP endpoint, the metadata-only MCP Apps project-plan picker, Microsoft Work IQ Word document creation, read-only OneDrive-to-PDF conversion, and scoped report-file persistence. It does not expose Project Plan Editor, Project Schedule Generator, or any project-data draft, edit, validation, commit, upload, create, update, or delete tool. Code Interpreter can generate temporary Excel, PowerPoint, PDF, and Word files; Work IQ Word can save Word reports to OneDrive, Work IQ OneDrive conversion can convert an exact generated OneDrive Word file to PDF, and the scoped SharePoint action can persist generated binary reports.

## Work IQ Word Setup

The Word action uses Microsoft’s preview `mcp_WordServer` endpoint. Before packaging or publishing, set `WORKIQ_TENANT_ID` and the package-local `WORKIQ_WORD_AUTH_ID_RESOURCE_MANAGER` in `env/.env.dev` or `env/.env.prod`. Create the latter as a Microsoft Entra SSO auth configuration for this package’s Teams app, using the Word server endpoint as its base URL. The auth configuration must authorize the Microsoft Work IQ Word MCP server; it is not the PDS DCR binding and cannot be created with the PDS `dcr/register` step.

## Work IQ OneDrive Conversion Setup

The conversion action uses the preview Work IQ hosted MCP endpoint `https://workiq.svc.cloud.microsoft/mcp` and exposes only `fetch_blob_work_iq` with the PDF format. Before packaging or publishing, set the package-local `WORKIQ_ONEDRIVE_CONVERSION_AUTH_ID_RESOURCE_MANAGER` in `env/.env.dev` or `env/.env.prod`. Create it as a separate Microsoft Entra SSO auth configuration for the hosted Work IQ endpoint. The action accepts only an exact `/me/drive/items/{itemId}/content` path and returns converted bytes without changing the source file. Work IQ conversion is tenant-dependent and limited to the hosted binary-download size limit (currently documented as 4 MB); larger or unsupported files remain temporary Code Interpreter downloads.

## Work IQ Report Storage Setup

The report-storage action uses `mcp_SharePointRemoteServer` and exposes only `createSmallBinaryFile` and `uploadFileFromUrl`. It does not provide SharePoint discovery or read access. Before packaging or publishing, set `WORKIQ_SHAREPOINT_REPORTS_AUTH_ID_RESOURCE_MANAGER` alongside `WORKIQ_TENANT_ID`, and create a Microsoft Entra SSO auth configuration for the SharePoint endpoint. The binding is independent of the PDS DCR and Word auth configurations. Files written through `createSmallBinaryFile` must be smaller than 5 MB; larger or unsupported artifacts remain temporary downloads.

## Generate and Validate

Run `npm run generate` and `npm run validate` from this directory. These commands only regenerate and structurally validate local source artifacts; they do not provision, deploy, publish, install, or alter tenant resources.

## Development Lifecycle

Keep `env/.env.*` local and package-specific. Do not copy `TEAMS_APP_ID` or `MCP_DA_AUTH_ID_RESOURCE_MANAGER` from another package. From the asset repository, use the [batch lifecycle runbook](../../README.md#development-provisioning-and-organization-submission) to dry-run, provision in a non-production tenant, personally install the dev package, test, then choose tenant-wide sharing or submission for admin review. Tenant sharing grants access but does not preinstall; administrators can optionally preinstall after approval. The coordinator requires `--execute` for tenant changes. Do not run `all --env dev --execute` if testing must happen between provisioning and submission.

## Migration

This package replaces one role from the retired invalid multi-agent suite. Install it as its own Microsoft 365 app. It does not reuse the retired suite's generated Teams app ID or DCR identifier.
