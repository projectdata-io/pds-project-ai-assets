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

Download and extract the artifact, then use an individual package ZIP. Do not upload the outer artifact archive. Each package is built with the dev app ID and PDS authentication binding configured in GitHub Actions. All seven packages use native, read-only Microsoft 365 capabilities to search SharePoint and OneDrive files, email, and Teams conversations the signed-in user can access; none has email or Teams write actions. The five analysis packages generate requested Word/PDF/Excel/PowerPoint reports with Code Interpreter as temporary download attachments. Users save reports to OneDrive or SharePoint manually. No Work IQ actions or report-upload connections are included. The editor packages do not generate or save reports and documents. These are dev-tenant packages, not production or public Marketplace packages.

## Personal test in Teams

All seven packages connect to PDS Project AI at `https://mcp.projectdata.ai/mcp/m365`, the Microsoft 365 compatibility endpoint. Ensure the service deployment supports this endpoint before installing or submitting updated packages. OAuth discovery stays at the service origin; existing origin-scoped PDS authentication bindings also cover this path.

Custom app upload must be enabled by your Teams administrator. Sign in to Teams in the tenant configured for these dev packages, then:

1. Open **Apps** > **Manage your apps** > **Upload an app** > **Upload a custom app**.
2. Select one of the `teams-*.zip` package files and choose **Add**.
3. Open the app in personal scope and complete its sign-in and project-plan selection flow.
4. Ask an analysis agent to answer a plan question using relevant SharePoint/OneDrive files, email, and Teams context; verify that it cites returned source metadata, distinguishes customer context from current MPP facts, and does not claim exhaustive search. Verify that it never changes project data. Request Word and PDF reports, open the actual attachments, and verify manual-save guidance without claims of cloud persistence. Repeat prompts in the same chat and a new chat to confirm there are no Work IQ connection requests. If report generation fails, verify an explicit failure rather than a nonexistent attachment. For Project Plan Editor and Project Schedule Generator, verify relevant M365 context can inform a draft and that clear write requests proceed without another approval loop. Email and Teams activity must remain read-only. Repeat with another package ZIP to test another role.

This installs the selected app for your account only. It does not make the app available to other users. If custom app upload is unavailable, ask your Teams administrator to enable or perform the test deployment.

See Microsoft's [custom app upload instructions](https://learn.microsoft.com/en-us/microsoftteams/platform/concepts/deploy-and-publish/apps-upload) for the current Teams UI and tenant requirements.

## Organization rollout

The ZIP artifact does not submit or publish apps. For the supported organization-review flow, use a checkout of this assets repository with its package-local `env/.env.dev` files configured. For a new version, bump and generate once, then prepare and validate the four active packages:

```powershell
npm run bump:teams-package-versions
npm run generate:teams-packages
npm run manage:teams-packages -- prepare --env dev --execute
```

Import the exact frozen ZIPs from `apps/<package>/appPackage/build/appPackage.dev.zip` into their existing Developer Portal apps, preserving app IDs, and verify each app ID/version readback. Then submit the same four ZIPs:

```powershell
npm run manage:teams-packages -- publish --env dev --execute --portal-verified
```

This submits Project Manager Assistant, MPP Data Auditor, Project Plan Editor, and Project Schedule Generator to the Teams admin center for review without rebuilding the ZIPs. It does not install them for everyone. Additional roles require an explicitly approved package selection. A Teams administrator must review and allow each submitted app, select its intended availability, and optionally configure installation for users. Follow the repository README's **Development provisioning and organization submission** section before running the command. Retry only `publish` with the same frozen ZIPs; `all --execute` is blocked to prevent rebuilding between portal synchronization and submission.

See Microsoft's [Teams app management guidance](https://learn.microsoft.com/en-us/microsoftteams/manage-apps). Organization rollout is separate from public Marketplace submission. Do not submit these dev-bound packages to the public Store or Partner Center.
