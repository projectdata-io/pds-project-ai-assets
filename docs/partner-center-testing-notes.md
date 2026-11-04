# Test PDS MPP in an External Tenant

## Contents

- [About the apps](#about-the-apps)
- [Test accounts](#test-accounts)
- [Configuration](#configuration)
- [Installation and setup](#installation-and-setup)
- [Testing workflows](#testing-workflows)
- [Limitations and test considerations](#limitations-and-test-considerations)
- [Resources](#resources)

## About the apps

These four agents help you review or work with Microsoft Project plans through
the PDS MPP service. You can only use plans your account is allowed to access.
Each agent has its own PDS connection, so sign in separately for each one.

| App | Version | Purpose |
| --- | --- | --- |
| PDS MPP: Project Manager Assistant | 2.3.10 | Summarizes project delivery, schedule health, milestones, dependencies, and risks. |
| PDS MPP: Data Auditor | 2.3.10 | Reviews MPP structure and data consistency, including hierarchy, progress, resources, calendars, and custom fields. |
| PDS MPP: Project Plan Editor | 2.3.11 | Stages, validates, and commits explicitly requested changes to a selected project plan. |
| PDS MPP: Project Schedule Generator | 2.3.16 | Drafts or creates a Microsoft Project schedule from supplied requirements. |

## Test accounts

Before testing, ask the external tenant admin to set up the accounts below.
Enter passwords and other credentials only in Partner Center's secure test
account fields. Do not put them in this document.

- Tenant you'll test in: `[organization and verified domain]`
- Admin helping with setup: `[secure account reference]`
- Tester 1: `[secure account reference; can open Test Project A]`
- Tester 2: `[secure account reference; cannot open Test Project A]`
- First-time tester: `[secure account reference; has not connected to PDS yet]`
- Getting PDS access: `[account setup steps and how a new tester requests access]`

Use made-up project data only. Prepare Test Project A with named tasks, dates,
dependencies, assignments, progress, and one known data issue. Give Tester 1
access, but do not give Tester 2 access. Make a separate copy for edit and
schedule-creation tests. If you test M365 search, add clearly labeled sample
documents, email, or Teams messages that only the intended test account can see.

## Configuration

Ask the external tenant admin to:

1. Make the **production** app packages available only to the named testers.
   The admin can upload each package to the tenant app catalog, or enable
   personal custom-app uploads for the testers.
2. Complete any admin consent the PDS connection requires. After setup, do the
   actual tests as a non-admin user, not as the admin.
3. Confirm the testers can use Microsoft 365 Copilot and can access only the
   synthetic data prepared for them.

Use the supplied production ZIPs listed in
[`dist/production-agent-release.json`](../dist/production-agent-release.json).
Do not use a dev package or a publisher-tenant account. Each agent has its own
production app ID and PDS sign-in.

## Installation and setup

1. Ask the admin to upload the production packages to the external tenant, or
   enable personal custom-app uploads for the testers.
2. Sign in to Teams as Tester 1. Find the app in the tenant catalog, or choose
   **Apps > Manage your apps > Upload an app > Upload a custom app** and select
   its production ZIP. Add it for personal use.
3. Repeat with Tester 2 and the First-time tester. Each person must use their
   own PDS connection; do not share connections between accounts.
4. Open each agent in Microsoft 365 Copilot in Teams. The first request that
   uses PDS starts that agent's PDS sign-in and consent flow. Signing in to
   Teams alone does not sign you in to PDS.
5. To test first-time sign-in, start with the First-time tester. To test denied
   consent, deny the PDS prompt, then grant consent and try again with that same
   account.

## Shared authentication tests

Run these checks for each agent. Each one connects to PDS separately.

1. Sign in as the First-time tester and ask: **"Summarize the delivery status
   of Test Project A."** Complete the PDS sign-in and consent prompt.
   - **You should see:** a response based on the test user's authorized project
     data.
2. Sign in as Tester 2 and ask the same question about Test Project A.
   - **You should see:** no project details. The agent explains that the file
     is unavailable or asks you to choose a file you can access.
3. As a fresh user, deny the PDS consent prompt and ask the project question
   again. Then grant consent and retry.
   - **You should see:** a clear failure and no project data before consent; a
     successful response after consent.
4. Disconnect or revoke the PDS connection in the host's account controls and
   ask the question again.
   - **You should see:** Teams remains signed in, while the PDS request asks you
     to authorize again. Access returns after you reconnect.
5. If you cannot disconnect PDS without signing out of Microsoft 365, note that
   sign-out did not pass; do not mark it complete.

## Agent-specific instructions

Run the matching test note for each submitted app:

- [Project Manager Assistant](partner-center-testing/project-manager-assistant.md)
- [Data Auditor](partner-center-testing/data-auditor.md)
- [Project Plan Editor](partner-center-testing/project-plan-editor.md)
- [Project Schedule Generator](partner-center-testing/schedule-generator.md)

## Shared test considerations

- You can only search files and M365 content that your account can access.
   Tester 2 must not be able to open Test Project A.
- Project Manager Assistant and Data Auditor only read plans. Plan Editor and
   Schedule Generator can make changes, so use disposable files with them.
- The live service must enforce access rules; agent instructions alone do not
   protect project data.
- A response or download card does not prove a file was saved. Open the
   destination and check the MPP yourself.
- Use made-up data. Never put passwords, tokens, signed URLs, or secrets in
   prompts or public files.

## Resources

- [PDS MPP customer support](mailto:support@projectdata.io)
- [Microsoft Teams custom app upload instructions](https://learn.microsoft.com/en-us/microsoftteams/platform/concepts/deploy-and-publish/apps-upload)
- [Production release ZIPs, versions, and hashes](../dist/production-agent-release.json)
