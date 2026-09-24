# PDS Project AI Agents

This release contains Microsoft Copilot Studio assets for working with Microsoft Project `.mpp` data through the PDS Project AI MCP server.

## What Is Included

### Agent packages

Each agent is delivered as a ZIP package containing everything needed to set it up in Copilot Studio:

| File | Use case |
| --- | --- |
| `PDSProjectManagerAssistant.zip` | Project status, risks, milestones, and delivery summaries |
| `PDSScheduleQualityAnalyst.zip` | Schedule quality, critical path, constraints, and data checks |
| `PDSResourceManager.zip` | Resource demand, capacity, and assignment reporting |
| `PDSPortfolioExecutiveAnalyst.zip` | Portfolio rollups, executive reporting, and cross-project analysis |
| `PDSProjectPlanEditor.zip` | Guarded draft and commit workflows |
| `PDSProjectScheduleGenerator.zip` | Schedule generation and validation |
| `PDSMppDataAuditor.zip` | Read-only MPP data audit and custom-field review |
| `PDSPortfolioListMaintainer.zip` | MPP file-change analysis and portfolio list payload generation |

Each package contains `instructions.md`, `manifest.json`, the full `SKILL.md` workflow files, a step-by-step `README.md`, and — where the agent supports it — an `agent.yaml` `BotDefinition` template with native inline skills and the MCP tool binding.

## Before You Start

You need:

1. Access to a Power Platform environment with Copilot Studio enabled.
2. Permission to create agents and connections.
3. Access to the deployed PDS Project AI MCP service.
4. Permission to create or authorize a connector connection for the PDS Project AI MCP connector.

## Set up an agent

1. Download the ZIP package for the agent you want.
2. Open the package and follow its `README.md`.
3. Create a blank agent in Copilot Studio and paste the package's `instructions.md` into **Overview → Instructions**.
4. Add the PDS Project AI server from **Tools → Add a tool → New tool → Model Context Protocol**, and authorize the connection.
5. Use each `skills/<name>/SKILL.md` as the authoring specification for a skill, topic or prompt tool.
6. Test the agent with a non-production `.mpp` file, then publish.

For agents that include an `agent.yaml` `BotDefinition` template, an administrator can instead materialize the full agent (including native inline skills) into a development environment with `pac copilot create`.

## Verify the Download

This release includes:

- `VERSION.txt`: the release version.
- `SHA256SUMS.txt`: checksums for the agent package ZIP files.

Use the checksums to confirm the downloaded ZIP files were not corrupted.

## Security Notes

- Require explicit user confirmation before any guarded edit or schedule-generation agent commits a change.
- Test imported agents in a non-production environment before publishing.
- Do not upload customer `.mpp` files to environments that are not approved for that data.
- Review connector connections and user consent before broad rollout.
