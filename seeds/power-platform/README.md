# Canonical Power Platform Seed

`Agentseed_1_0_0_1.zip` is an audited unmanaged solution exported from a non-production Power Platform environment.

It provides the canonical component structures that can't be invented safely by an offline PAC scaffold:

- Standard Agent and system topics.
- PDS Project AI MCP custom connector using `mcp-streamable-1.0`.
- Agent connection reference and connector binding.
- Known-good native MCP `TaskDialog` invoking `InvokeServer`.

The compiler clones this seed for each catalog agent, replaces seed identity and instructions (embedding the full workflow procedures), and adds one triggerable topic per mapped skill. The seed's single MCP `TaskDialog` is preserved unchanged. PAC validates every generated solution by unpacking it after packaging.

The seed contains no credentials, tokens, current connection values, tenant IDs, user identities, or customer data. It references the public production MCP endpoint. Connections and OAuth consent must be created in each target environment after import.

Do not edit seed archive components manually. To update the seed, configure and export a replacement unmanaged solution from a non-production environment, audit it for sensitive values, replace the ZIP, and rerun the full build and verification suite.

## Agent template source

For Agents, use `pac copilot extract-template` in addition to the unmanaged solution export. PAC represents this product internally as `CliCopilot`. The extracted `BotDefinition` is the authoritative source for inline skills and MCP tool components because those components might not appear in the ordinary solution ZIP.

Raw extracted templates are environment-specific and must remain outside source control until sanitized. Retain these structures during sanitization:

- `DialogComponent.dialog.kind: McpTool`
- `DialogComponent.dialog.kind: InlineAgentSkill`
- `connectionReferences`
- `connectorDefinitions`
- `entity.configuration.authoringModel: CliCopilot`

Remove audit identities, timestamps, synchronization details, application IDs, environment-specific connection IDs, and unrelated system environment variables. Deployment must inject a valid target-environment connection before calling `pac copilot create`.