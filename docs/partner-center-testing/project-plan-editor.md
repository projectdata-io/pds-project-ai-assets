# PDS MPP: Project Plan Editor

**Package version:** 2.3.11

## About the app

Use this note to test Project Plan Editor. It prepares, checks, and commits
changes you request to a selected Microsoft Project plan. Use a disposable copy
of made-up test data for every write test.

## Test accounts and data

Ask the tenant admin to set up the accounts below. Enter passwords only in
Partner Center's secure test-account fields; never put them in this document.

- External test tenant: `[organization and verified domain]`
- Tenant administrator: `[secure account reference]`
- Non-admin write tester: `[secure account reference; PDS-connected; authorized for the test workspace]`
- First-run user: `[secure account reference; not yet PDS-connected]`
- Original MPP: `[read-only baseline file location]`
- Disposable MPP: `[separate writable copy location]`
- Expected edit: `[task/resource/dependency and original/new values]`

Ask the admin to make production version 2.3.11 available and complete any
required tenant consent. Give the tester write access only to the disposable
file. Keep the original read-only.

## Installation and sign-in

1. Ask the admin to upload the production ZIP to the tenant app catalog and
   allow the test users, or enable personal custom-app uploads.
2. In Teams, sign in as the non-admin write tester and add **PDS MPP Plan
   Editor** for personal use.
3. Open the agent in Microsoft 365 Copilot in Teams. Select the disposable MPP
   and sign in to PDS when prompted.
4. Repeat with the first-run account. Deny consent once, then grant it and try
   again. Finally, disconnect the PDS connection in the host's account controls
   and retry. Teams should stay signed in; PDS should ask you to reconnect.

## Test workflow

1. Ask: **"Change the duration of task [exact task name] from [current value] to
   [new value]. Show me the proposed change before committing it."** Use the
   exact values from the fixture.
   - **You should see:** the agent identifies the intended task, stages the requested
     change, and reports validation results. No other task is changed.
2. Review the proposed change. Then explicitly ask the agent to commit it.
   - **You should see:** the operation succeeds only for the disposable MPP. Reopen or
     reread the file and verify that the target task has the new duration.
3. Ask: **"Move the task earlier in the schedule."** Do not specify a task or
   target date.
   - **You should see:** the agent asks for the missing details and makes no
     change until they are clear.
4. Attempt an edit to a file the user cannot access, if one is provisioned.
   - **You should see:** the service denies the write and leaves the file unchanged.
5. If the test environment supports a failed or interrupted write, retry the
   same request.
   - **You should see:** the agent reports the saved result accurately and does not
     not create a duplicate edit.
6. Compare the original baseline with its pre-test copy.
   - **You should see:** the baseline remains unchanged. The edit appears
     only in the authorized disposable file.

## Limitations

You need a PDS connection and write permission for the selected test file. The
agent's instructions do not enforce security; confirm the live service checks
which user can change which file. Use only the disposable MPP. Reopen it to
verify a change; a message from the agent or an upload acknowledgement is not
proof that the change was saved.

## Resources

- [Shared tenant setup and sign-in tests](../partner-center-testing-notes.md)
- [Production package IDs, versions, and hashes](../../dist/production-agent-release.json)
- PDS access: `support@projectdata.io`
