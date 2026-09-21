# PDS Project AI Assets

Public, reusable agent assets for working with Microsoft Project MPP files through the PDS Project AI MCP server.

## Repository layout

- `skills/`: multi-step, reusable workflows packaged as `SKILL.md` files.
- `agents/`: role-focused agent definitions and Copilot Studio instruction sets.
- `prompts/`: focused, parameterized prompt templates.
- `examples/`: sample configurations and expected outputs using synthetic data.
- `schemas/`: machine-readable schemas for asset metadata and validation.
- `templates/`: starting points for new assets.
- `scripts/`: repository validation utilities.

This repository is also consumed as a submodule by the PDS Project AI product repository. Its top-level folders are intentionally not VS Code workspace discovery locations. Consumers should install or copy selected assets into the location required by their agent platform.

## Development

Requirements: Node.js 20 or newer.

```sh
npm test
```

See [CONTRIBUTING.md](CONTRIBUTING.md) before adding an asset.

## License

Released under the [MIT License](LICENSE).