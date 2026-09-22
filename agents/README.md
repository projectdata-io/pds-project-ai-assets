# Agents

Store focused agent definitions and platform-specific instruction sets here. Keep platform variants in explicit subdirectories such as `copilot-studio` or `github-copilot` when their formats differ.

Use [the agent template](../templates/agent/agent.template.md) for role definition and safety boundaries.

## Copilot Studio packages

Each package under `copilot-studio/` contains:

- `agent.json`: portable role metadata and its allowed skill set.
- `instructions.md`: instructions to configure in Copilot Studio.

These files intentionally do not contain tenant, environment, connection, deployment, or authentication values.

The `skills` arrays in `agent.json` are repository routing metadata. They are not Copilot Studio native skill components.

| Package | Access | Standard Agent | Agent |
| --- | --- | --- | --- |
| `project-manager-assistant` | Read-only | Yes | Yes |
| `schedule-quality-analyst` | Read-only | Yes | Yes |
| `resource-manager` | Read-only | No | Yes |
| `portfolio-executive-analyst` | Read-only | Yes | Yes |
| `project-plan-editor` | Commit after preview, validation, and confirmation | No | Yes |
| `project-schedule-generator` | Commit after preview, validation, and confirmation | No | Yes |
| `mpp-data-auditor` | Read-only | Yes | Yes |
| `portfolio-list-maintainer` | Read-only; caller writes SharePoint list rows | Yes | No |

## Generate Copilot Studio bundles

Run:

```sh
npm run compile
npm run compile:agents
```

Each directory under ignored `build/copilot-studio/` contains:

- `instructions.md`: the base agent instructions plus a concise workflow routing catalog.
- `manifest.json`: the agent metadata, access level, exact MCP tool allowlist, and topic inventory.
- `topics/*.md`: condensed, copy-ready authoring instructions derived from mapped skills.

Compiled files are deterministic transient build outputs and are not committed. Run `npm run compile` before inspecting them; `npm test` compiles and validates them automatically.

See [Apply Generated Assets in Copilot Studio](copilot-studio/README.md) for the complete setup, permission, topic-authoring, testing, and publishing procedure.

## Apply a bundle in Copilot Studio

1. Create a blank agent and use the title and description from `manifest.json`.
2. Paste the generated `instructions.md` into **Overview → Instructions**.
3. Add the PDS Project AI server from **Tools → Add a tool → New tool → Model Context Protocol**.
4. Use the manifest's `tools` array as the allowlist. Disable unrelated MCP tools when the environment supports per-tool controls.
5. Grant `Session.ReadOnly` to read-only agents and `Session.ReadWrite` only to the Project Plan Editor or Project Schedule Generator.
6. For each generated topic file, create the corresponding Copilot Studio topic or prompt workflow and use its Markdown as the authoring specification. Reference configured MCP tools with the Copilot Studio slash menu where appropriate.
7. Require end-user confirmation for `commit_edit_draft` and any externally visible write.
8. Test the agent with the matching cases in `examples/evaluations.json` before publishing.

The compiled workflow files are portable authoring assets. Each catalog agent is packaged into a ZIP containing the agent instructions, manifest, full `SKILL.md` files, a manual setup guide, and — for agents targeting the **Agent** product — a `BotDefinition` YAML template with native inline skills and the MCP tool binding.