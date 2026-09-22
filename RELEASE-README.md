# PDS Project AI Agents

This release contains Microsoft Copilot Studio assets for working with Microsoft Project `.mpp` data through the PDS Project AI MCP server.

## What Is Included

### Ready-to-import Standard Agents

Standard Agents are the Dataverse solution-friendly Copilot Studio assets. Use the unmanaged Power Platform solution ZIP files when you want an importable package for makers or administrators.

Included solution ZIP assets:

| File | Use case |
| --- | --- |
| `PDSProjectManagerAssistantStandard.zip` | Project status, risks, milestones, and delivery summaries |
| `PDSScheduleQualityAnalystStandard.zip` | Schedule quality, critical path, constraints, and data checks |
| `PDSPortfolioExecutiveAnalystStandard.zip` | Portfolio rollups, executive reporting, and cross-project analysis |
| `PDSMppDataAuditorStandard.zip` | Read-only MPP data audit and custom-field review |

Each solution includes the Copilot Studio agent package, the PDS Project AI MCP custom connector, connection-reference metadata, and native MCP tools for that agent.

### Agent templates

Agents are handled through the YAML/BotDefinition authoring path. This release may also include template files for advanced administrator-managed deployment scenarios:

- `project-manager-assistant.yaml`
- `schedule-quality-analyst.yaml`
- `resource-manager.yaml`
- `portfolio-executive-analyst.yaml`
- `project-plan-editor.yaml`
- `mpp-data-auditor.yaml`

These templates are not directly importable through the Copilot Studio user interface. They are included for administrators who have a managed deployment process for Agents.

## Before You Start

You need:

1. Access to a Power Platform environment with Copilot Studio enabled.
2. Permission to import unmanaged solutions.
3. Access to the deployed PDS Project AI MCP service.
4. Permission to create or authorize a connector connection for the PDS Project AI MCP connector.

Use read-only authorization for read-only agents. Use read/write authorization only for agents that intentionally perform guarded edit or commit operations.

## Deploy a Standard Agent from a solution ZIP

1. Download the solution ZIP for the agent you want to use.
2. In Power Apps or Power Platform admin tools, import the ZIP as an unmanaged solution.
3. During or after import, create or select the connector connection for PDS Project AI.
4. Open the imported agent in Copilot Studio.
5. Confirm the connection reference is bound to the intended connection.
6. Test the agent with a non-production `.mpp` file.
7. Publish the agent when testing is complete.

After import, review the agent's tools and permissions before making it available to users.

## Deploy an Agent from a template

Agent templates require an administrator-managed deployment process before users can open and publish them in Copilot Studio.

If you received this release as an end user, ask your Power Platform administrator or project AI platform owner to materialize the Agent templates in your environment. Once materialized, the Agents can be tested and published from Copilot Studio like other agents.

## Verify the Download

This release includes:

- `VERSION.txt`: the release solution version.
- `SHA256SUMS.txt`: checksums for the solution ZIP files.

Use the checksums to confirm the downloaded ZIP files were not corrupted.

## Security Notes

- Do not grant read/write access to read-only agents.
- Test imported agents in a non-production environment before publishing.
- Do not upload customer `.mpp` files to environments that are not approved for that data.
- Review connector connections and user consent before broad rollout.
