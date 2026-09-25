# Teams Project Manager Assistant

Microsoft 365 declarative agent scaffold for read-only project analysis through the existing PDS Project AI MCP service.

## Scope

The agent supports project summary, schedule health, critical path, milestone review, lookahead, dependency audit, constraint review, and project-manager briefs. It does not edit, commit, upload, provision, deploy, or manage projects or external resources.

## Configure the Existing MCP Connection

1. Create the ignored local file `env/.env.dev` for Toolkit provisioning:

	```ini
	TEAMSFX_ENV=dev
	APP_NAME_SUFFIX=dev
	```

    Do not commit the local file. Remove the local `.env` file before running this repository's `npm test`, which rejects all `.env` artifacts.
2. Do not manually set `TEAMS_APP_ID`, `MCP_DA_AUTH_ID_PDSPROJECTAI`, OAuth credentials, client IDs, secrets, or scopes. The Microsoft 365 Agents Toolkit provisioning flow creates the Teams app and DCR authentication configuration, then writes their generated identifiers.
3. Keep `appPackage/ai-plugin.json` restricted to the read-only PDS functions listed there. Do not add draft, validation, or commit functions to this agent.
4. Keep `declarativeAgent.json` pointing at `ai-plugin.json`.

The committed `ai-plugin.json` reserves an OAuth Plugin Vault binding for the public PDS MCP endpoint and limits the agent to the existing Project Manager Assistant tool allowlist. The asset repository intentionally does not keep `.env` example files.

## Local Validation

```powershell
$env:ATK_CLI_SKILL = 'true'
atk package --env dev -i false
atk validate --env dev -i false
```

These commands package and validate local project configuration only. Run Toolkit provisioning from an authenticated development tenant when ready to create the Teams app and DCR authentication configuration; do not use production tenant credentials for development validation.
