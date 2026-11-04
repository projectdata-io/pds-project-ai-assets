# PDS MPP: Data Auditor

**Package version:** 2.3.10

## About the app

Use this note to test Data Auditor. It checks a Microsoft Project plan for
structural and data issues, such as task hierarchy, dependencies, progress,
resources, calendars, and custom fields. It only reads the plan.

## Test accounts and data

Ask the tenant admin to set up the accounts below. Enter passwords only in
Partner Center's secure test-account fields; never put them in this document.

- External test tenant: `[organization and verified domain]`
- Tenant administrator: `[secure account reference]`
- Non-admin test user: `[secure account reference; PDS-connected]`
- First-run user: `[secure account reference; not yet PDS-connected]`
- Test file: `[OneDrive or SharePoint location of synthetic MPP]`
- Seeded issue and expected finding: `[describe the exact field/task and expected result]`

Tester: make sure the non-admin account can open the test file but cannot access
other customer data. Add one known issue to the test file and provide a clean
comparison file. Ask the admin to make the production app available and
complete any required tenant consent.

## Installation and sign-in

1. Ask the admin to upload production version 2.3.10 to the tenant app catalog
   and allow the test account, or enable personal custom-app uploads.
2. In Teams, sign in as the non-admin tester and add **PDS MPP Data Auditor**
   for personal use.
3. Open the agent in Microsoft 365 Copilot in Teams. Send the first test prompt
   below and sign in to PDS when prompted.
4. Repeat with the first-run account. Deny consent once, then grant it and try
   again. Finally, disconnect the PDS connection in the host's account controls
   and retry. Teams should stay signed in; PDS should ask you to reconnect.

## Test workflow

1. Select the MPP containing the seeded issue and ask: **"Audit the task
   hierarchy, dependencies, and progress consistency in this plan. Show the
   affected task names and supporting data."**
   - **You should see:** the seeded issue reported with evidence from the
     selected file. The agent does not report unrelated defects.
2. Ask: **"Review the resource assignments, calendars, and custom fields for
   inconsistencies."**
   - **You should see:** findings tied only to fields in the file and
     supported by its contents.
3. Select the clean comparison file and repeat the audit.
   - **You should see:** no report of the seeded issue in the clean file.
4. Ask the agent to change a task, resource, or dependency.
   - **You should see:** no change, and no claim that a change was made.
5. Compare both files with their pre-test copies.
    - **You should see:** both files remain unchanged; nothing was edited,
       committed, uploaded, or deleted.

## Limitations

Before testing, make sure your account has an authorized PDS connection and can
open a supported MPP file. Search only returns content you can access. Use
made-up data, then compare the files with their untouched copies. This agent is
read-only.

## Resources

- [Shared tenant setup and sign-in tests](../partner-center-testing-notes.md)
- [Production package IDs, versions, and hashes](../../dist/production-agent-release.json)
- PDS access: `support@projectdata.io`
