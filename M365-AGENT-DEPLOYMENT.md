# PDS Project AI M365 Agent Deployment

## What is in this download

The `m365-agent-installable-packages` artifact contains this guide and seven separate Microsoft 365 app packages:

- `teams-project-manager-assistant.zip`
- `teams-schedule-quality-analyst.zip`
- `teams-portfolio-executive-analyst.zip`
- `teams-resource-manager.zip`
- `teams-mpp-data-auditor.zip`
- `teams-project-plan-editor.zip`
- `teams-project-schedule-generator.zip`

Download and extract the artifact, then use an individual package ZIP. Do not upload the outer artifact archive. Each package is built with the dev app ID and PDS authentication binding configured in GitHub Actions. All seven packages use native, read-only Microsoft 365 capabilities to search SharePoint and OneDrive files, email, and Teams conversations the signed-in user can access; none has email or Teams write actions. The five analysis packages also include Work IQ Word, OneDrive conversion, and report-storage actions for user-requested reports. The editor packages do not generate or save reports and documents. These are dev-tenant packages, not production or public Marketplace packages.

## Personal test in Teams

Custom app upload must be enabled by your Teams administrator. Sign in to Teams in the tenant configured for these dev packages, then:

1. Open **Apps** > **Manage your apps** > **Upload an app** > **Upload a custom app**.
2. Select one of the `teams-*.zip` package files and choose **Add**.
3. Open the app in personal scope and complete its sign-in and project-plan selection flow.
4. Ask an analysis agent to answer a plan question using relevant SharePoint/OneDrive files, email, and Teams context; verify that it cites returned source metadata, distinguishes customer context from current MPP facts, and does not claim exhaustive search. Verify that it never changes project data, and test report saving only when explicitly requested. For Project Plan Editor and Project Schedule Generator, verify relevant M365 context can inform a draft and that clear write requests proceed without another approval loop. Email and Teams activity must remain read-only. Repeat with another package ZIP to test another role.

This installs the selected app for your account only. It does not make the app available to other users. If custom app upload is unavailable, ask your Teams administrator to enable or perform the test deployment.

See Microsoft's [custom app upload instructions](https://learn.microsoft.com/en-us/microsoftteams/platform/concepts/deploy-and-publish/apps-upload) for the current Teams UI and tenant requirements.

## Organization rollout

The ZIP artifact does not submit or publish apps. For the supported organization-review flow, use a checkout of this assets repository with its package-local `env/.env.dev` files configured, then run:

```powershell
npm run manage:teams-packages -- publish --env dev --execute
```

This command rebuilds and submits the seven dev apps to the Teams admin center for review; it does not install them for everyone. A Teams administrator must review and allow each app, select its intended availability, and optionally configure installation for users. Follow the repository README's **Development provisioning and organization submission** section before running the command. Do not use `all --execute` as a substitute: that also runs provisioning.

See Microsoft's [Teams app management guidance](https://learn.microsoft.com/en-us/microsoftteams/manage-apps). Organization rollout is separate from public Marketplace submission. Do not submit these dev-bound packages to the public Store or Partner Center.
