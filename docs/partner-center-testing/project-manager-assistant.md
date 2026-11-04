# PDS MPP: Project Manager Assistant

**Package version:** 2.3.10

## About the app

Use this note to test Project Manager Assistant. The agent helps you understand
delivery status, schedule health, milestones, dependencies, and risks from a
Microsoft Project plan you can access. It only reads the plan.

## Test accounts and data

Ask the tenant admin to set up the accounts below. Enter passwords only in
Partner Center's secure test-account fields; never put them in this document.

- External test tenant: `[organization and verified domain]`
- Tenant administrator: `[secure account reference]`
- Non-admin test user: `[secure account reference; PDS-connected]`
- First-run user: `[secure account reference; not yet PDS-connected]`
- Test file: `[OneDrive or SharePoint location of synthetic MPP]`
- Expected facts: `[task names, dates, progress, milestones, and known risks]`

Tester: make sure the non-admin account can open the test file but cannot access
other customer data. Ask the admin to make the production app available and
complete any required tenant consent.

## Installation and sign-in

1. Ask the admin to upload production version 2.3.10 to the tenant app catalog
   and allow the test account, or enable personal custom-app uploads.
2. In Teams, sign in as the non-admin tester and add **PDS MPP Project
   Manager** for personal use.
3. Open the agent in Microsoft 365 Copilot in Teams. Send the first test prompt
   below and sign in to PDS when prompted.
4. Repeat with the first-run account. Deny consent once, then grant it and try
   again. Finally, disconnect the PDS connection in the host's account controls
   and retry. Teams should stay signed in; PDS should ask you to reconnect.

## Test workflow

1. Select the synthetic MPP file and ask: **"Summarize the current delivery
   status of [project name]. Include evidence from the tasks."**
   - **You should see:** a summary that refers to real task names, dates, progress, or
     dependencies in the file. It distinguishes project facts from analysis.
2. Ask: **"Assess schedule health and identify the three most important delivery
   risks."**
   - **You should see:** risks supported by project data. The agent does not
     invent dates, progress, or dependencies.
3. Ask: **"Prepare a concise project-manager brief for the current reporting
   period."**
   - **You should see:** a concise brief consistent with the earlier results,
     and identifies assumptions or missing data.
4. Ask the agent to make a change to the MPP.
   - **You should see:** no edit, commit, upload, or delete operation.
5. Compare the MPP with the pre-test copy.
   - **You should see:** the file is unchanged.

## Limitations

On first sign-in to PDS, your account is automatically created and assigned to
the Freemium plan. Make sure you can open a supported MPP file. Search only
returns content you can access. Use made-
up project data. This agent is read-only; a report or download card does not
mean the source project changed.

## Resources

- [Shared tenant setup and sign-in tests](../partner-center-testing-notes.md)
- [Production package IDs, versions, and hashes](../../dist/production-agent-release.json)
- PDS access: `support@projectdata.io`
