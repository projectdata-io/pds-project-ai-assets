# Playwright agent publication

This automation updates **existing** dev agents in Microsoft Teams Developer Portal
and the tenant app catalog. It does not deploy the backend, create app identities,
change audience permissions, bump versions, rebuild packages, or publish inactive
agents. Backend deployments remain in GitHub Actions.

## Prerequisites

- Run from the **assets repository root** (this submodule, or its standalone clone)
  with Node.js 20+ and dependencies installed using
  `pnpm install --frozen-lockfile`.
- Microsoft Edge installed locally. The script uses Playwright's `msedge` channel;
  no separate Playwright browser download is needed.
- Developer Portal access and Teams administrator permissions in the intended
  tenant. Verify the account/tenant during interactive login.
- Generate the intended source changes, then validate and package each selected
  agent **once**, following the asset repository's
  [release synchronization procedure](../README.md#mandatory-release-synchronization).
  For WIQD projects, use `wiqd agent validate --path <app-folder> --env dev --json`,
  then `wiqd agent package --path <app-folder> --env dev --json`.
  Do not provision new identities. The browser script consumes existing
  `apps/<slug>/appPackage/build/appPackage.dev.zip`
  artifacts. It checks ZIP identity, version against source metadata, and inlined
  instructions; these checks do **not** replace WIQD schema validation or evals.

The default targets are Manager, Auditor, Editor, and Generator. Existing app and
catalog IDs are pinned in
[the script](../scripts/publish-agents-playwright.ts). An identity migration
requires an explicit reviewed code change, not an arbitrary CLI ID override.

## Run

```powershell
# When starting in the connector repository, first enter the assets submodule:
Set-Location .\external\pds-project-ai-assets

# Local preflight only; no browser, journal, network requests, or uploads.
pnpm publish:agents

# Complete sign-in/MFA in both tabs. Press Enter to verify both surfaces.
pnpm publish:agents --login

# Publish the frozen ZIPs and verify persisted versions on both surfaces.
pnpm publish:agents --execute --report .\tmp\release-2026-10-22.json

# Or release a subset of active agents.
pnpm publish:agents --agents auditor --execute --report .\tmp\auditor-release.json
```

The persistent Edge profile defaults to
`%LOCALAPPDATA%\PDS-Project-AI\publication-edge-profile` on Windows.
Use `--profile C:\outside-repo\publication-profile` to override it on both login
and publication commands. The profile **must be outside the repository**, including
through filesystem junctions. It contains authentication state: keep it private,
do not commit/share it, and do not open it in two concurrent Edge processes.
No passwords, tokens, cookies, storage dumps, or screenshots are exported by the
script. MFA and conditional-access prompts require human interaction.
Pressing Enter during `--login` now checks access to the selected app in both
Developer Portal and the tenant catalog before closing Edge and reporting
success. This check requires that app's already-built ZIP. Do not press Enter
while an MFA approval/code prompt is pending. Authentication can expire again
later due to tenant policy; a persistent profile does not bypass MFA.

Use one journal per release and do not run concurrent publications. The default
journal is `tmp/agent-publication.json` (gitignored); a dated `--report` is clearer.
The journal contains versions, app/catalog IDs, ZIP paths and SHA-256 checksums,
source commits with dirty-tree markers, stage status, and readback timestamps.
It is not an authentication file. It records source state at invocation; it does
not prove that an earlier build was produced from a clean source commit.

## Safety and recovery

1. All selected ZIPs are read into memory before browser operations. Both uploads
   use the **same bytes**, even if a local file changes mid-run.
2. The script checks every selected app on both surfaces before writing. It
   requires the original app IDs and current Everyone availability, refuses
   downgrades, and never modifies availability.
3. For each app, Developer Portal is synchronized and read back before catalog
   upload. Portal validation must display `No issues found`.
4. Each upload is journaled as `upload-started` **before** any UI mutation.
   Uploads are never retried automatically. Persisted readback reloads up to three
   times for stale versions. Authentication, identity, permission, navigation, and
   unexpected UI errors stop the run explicitly.
5. After all stages, fresh readback checks both surfaces again. A matching
   existing version is skipped and recorded as `already-current`; UI version
   readback cannot establish the checksum of a remote package. Never reuse a
   version number for changed package contents.
6. Resume a partial release with the **same command, agent selection, journal, and frozen ZIPs**.
   A completed remote upload can be verified without repeating it. If a journaled
   upload still shows the previous version, the script stops instead of guessing
   whether retrying is safe. Inspect that specific stage in the browser. Only
   after confirming no update occurred should an operator reset that stage's
   journal status to `pending`; retain the same ZIP/version.
7. If artifacts differ from the journal, restore the original release artifacts
   to resume. Use a new journal only for a genuinely new release, never to bypass
   an uncertain upload. Never bump versions just to recover stale readback.

Microsoft can change these browser interfaces. Missing controls, delayed
availability, login redirects, and CDN failures are not treated as success. If a
read-only navigation fails, fix the cause and rerun with the same journal; do not
rebuild or reupload blindly. Upload acknowledgement alone does not mark a stage
verified.

Catalog readiness uses the expected app identity and published version, not the
`Upload file` button: an already-current version can be verified without that
control. Uploads still require the exact upload control (including controls
excluded from the accessibility tree). A detected `Loading chunk ... failed` or
`ChunkLoadError` permits one read-only navigation retry, never an upload retry.
An empty app-detail shell is also reloaded once if it stalls for 60 seconds or
reports the observed MobX error 35. A second failure stops with the runtime
classification; this is a rendering failure, not evidence of an MFA prompt.
Runtime listeners are removed after each read. This shares the same one-reload
budget as CDN recovery and does not reset journal stages or retry uploads.
Login and access-denied pages fail explicitly. Readiness/upload-control failures
report the page origin/path (without query strings), classified state, and upload
control count; no page text or browser storage is dumped.

Authentication detection includes Microsoft sign-in frames inside the admin
shell, page titles, and MFA screens such as **Approve sign in**, **Verify your
identity**, and **Request wasn't sent**. These must not be mistaken for a stalled
catalog page. Complete MFA yourself using `--login`; no automated approval is
attempted.

If a run previously timed out waiting for `Upload file`, rerun with the same
profile, journal, selection, and frozen ZIPs. The all-target preflight does not
upload anything. If authentication is reported, run `pnpm publish:agents --login`
with that same profile first. A journaled uncertain write still requires the
manual recovery procedure above; do not delete the journal or bump versions.

This script has local safety tests and an isolated Edge UI fixture; this is not
proof of a real tenant publication or live Copilot instruction compliance.
Perform fresh-chat acceptance separately after an actual release.

## Tests

```powershell
pnpm test:agents:publication
pnpm test:agents:browser
pnpm check:agents:publication
pnpm run test
```

The optional browser fixture requires local Edge, intercepts **all** browser
requests, and uses synthetic packages. It verifies hidden-dialog controls,
byte-identical uploads, asynchronous catalog acknowledgement, persisted
readback, and duplicate-upload avoidance without contacting Microsoft.
