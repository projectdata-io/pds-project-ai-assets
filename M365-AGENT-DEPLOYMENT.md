# PDS Project AI Internal Dev Agent Testing

This guide covers internal dev-tenant packages only. The ZIPs produced from `env/.env.dev` are tenant-bound test artifacts, not customer releases; do not distribute them to external tenants. Customer packages require separate production identities, cross-tenant authentication, external-tenant acceptance, and the gates in [the public release checklist](docs/public-marketplace-release-checklist.md).

## Active dev packages

The four active dev packages are:

- `teams-project-manager-assistant.zip`
- `teams-mpp-data-auditor.zip`
- `teams-project-plan-editor.zip`
- `teams-project-schedule-generator.zip`

Configure each package's ignored `env/.env.dev` locally, then package and validate the four ZIPs from the assets repository root:

```powershell
npm run manage:teams-packages -- prepare --env dev --execute
```

Use the ZIPs only in the configured dev tenant. They are not suitable for customer tenants. Customer distribution requires production identities, cross-tenant authentication, external-tenant testing, and the public-release checklist gates.

## Personal test in Teams

All four active packages connect to PDS Project AI at `https://mcp.projectdata.ai/mcp/m365`, the Microsoft 365 compatibility endpoint. Ensure the service deployment supports this endpoint before installing or submitting updated packages. OAuth discovery stays at the service origin; existing origin-scoped PDS authentication bindings also cover this path.

Custom app upload must be enabled by your Teams administrator. Sign in to Teams in the tenant configured for these dev packages, then:

1. Open **Apps** > **Manage your apps** > **Upload an app** > **Upload a custom app**.
2. Select one of the `teams-*.zip` package files and choose **Add**.
3. Open the app in personal scope and complete its sign-in and project-plan selection flow.
4. Ask Project Manager Assistant or MPP Data Auditor to answer a plan question using relevant SharePoint/OneDrive files, email, and Teams context; verify source citations, manual report downloads when requested, and that project data is never changed. For Project Plan Editor and Project Schedule Generator, verify relevant M365 context can inform a draft and clear write requests proceed without another approval loop. Email and Teams activity must remain read-only. Repeat with another active package ZIP to test another role.

These dev packages work only with the configured development tenant and are not for customer tenants. This installs the selected app for your account only. It does not make the app available to other users. If custom app upload is unavailable, ask your Teams administrator to enable or perform the test deployment.

See Microsoft's [custom app upload instructions](https://learn.microsoft.com/en-us/microsoftteams/platform/concepts/deploy-and-publish/apps-upload) for the current Teams UI and tenant requirements.

## Internal dev-tenant rollout

There is no GitHub Actions dev ZIP artifact. For internal testing or organization rollout in the configured dev tenant, use a checkout of this assets repository with its package-local `env/.env.dev` files configured. For a new version, bump and generate once, then prepare and validate the four active packages locally:

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
