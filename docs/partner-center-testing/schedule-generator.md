# PDS MPP: Project Schedule Generator

**Package version:** 2.3.16

## About the app

Use this note to test Schedule Generator. It can help you draft a schedule for
review or create a completed Microsoft Project file from requirements. Save
completed-file tests to a new disposable location; never overwrite customer
data.

## Test accounts and data

Ask the tenant admin to set up the accounts below. Enter passwords only in
Partner Center's secure test-account fields; never put them in this document.

- External test tenant: `[organization and verified domain]`
- Tenant administrator: `[secure account reference]`
- Non-admin test user: `[secure account reference; PDS-connected]`
- First-run user: `[secure account reference; not yet PDS-connected]`
- Output location: `[disposable OneDrive, SharePoint, or download test location]`
- Test requirements: use the sample schedule below or replace it with an approved
  synthetic scenario.

Ask the admin to make production version 2.3.16 available and complete any
required tenant consent. Make sure the tester can write to the test output
location but cannot access unrelated customer data.

## Installation and sign-in

1. Ask the admin to upload the production ZIP to the tenant app catalog and
   allow the test users, or enable personal custom-app uploads.
2. In Teams, sign in as the non-admin tester and add **PDS MPP Schedule
   Generator** for personal use.
3. Open the agent in Microsoft 365 Copilot in Teams. Send the first test prompt
   and sign in to PDS when prompted.
4. Repeat with the first-run account. Deny consent once, then grant it and try
   again. Finally, disconnect the PDS connection in the host's account controls
   and retry. Teams should stay signed in; PDS should ask you to reconnect.

## Test workflow

Use this synthetic schedule request:

- Project: `External tenant schedule test`
- Start date: `January 11, 2027`
- `Define scope`: 2 days
- `Approve requirements`: 1 day, after `Define scope`
- `Draft test plan`: 2 days, after `Approve requirements`
- `Run pilot`: 3 days, after `Draft test plan`
- `Review results`: 1 day, after `Run pilot`

1. Ask: **"Build a draft schedule from these deliverables, dates, and
   assumptions: [paste the sample schedule requirements]."**
   - **You should see:** a reviewable draft. The agent asks about genuinely
     missing or ambiguous decisions, and validates it. It does not claim that a
     completed MPP was saved.
2. In a separate request, ask: **"Create a complete Microsoft Project schedule
   from these approved requirements: [paste the sample schedule requirements]."**
   - **You should see:** a completed MPP with the five named tasks, requested
     durations, and predecessor relationships. The agent does not silently
     invent unresolved requirements.
3. Choose the delivery option in the returned file card. Open the resulting MPP
   from the selected destination.
   - **You should see:** the file at that destination, with contents matching
     the approved schedule. The agent reports success only after the tool
     confirms the result.
4. Repeat with a missing target date or unclear dependency.
   - **You should see:** the agent asks for clarification and does not commit a
     completed schedule until the ambiguity is resolved.
5. If the test environment supports a failed or repeated commit, retry the same
   request.
   - **You should see:** an accurate report of the saved result and no duplicate
     project or schedule is created.

## Limitations

You need a PDS connection and permission to use the chosen output location. A
draft is not a completed file. Use a disposable location, then open the MPP to
confirm it was saved and contains the expected tasks. Do not use customer data.

## Resources

- [Shared tenant setup and sign-in tests](../partner-center-testing-notes.md)
- [Production package IDs, versions, and hashes](../../dist/production-agent-release.json)
- PDS access: `support@projectdata.io`
