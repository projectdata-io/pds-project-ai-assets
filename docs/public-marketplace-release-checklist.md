# Public M365 Agent Release Checklist

This checklist is for publishing these four PDS Project AI M365 agents to
customers outside the publisher's tenant:

- Project Manager Assistant (read-only)
- MPP Data Auditor (read-only)
- Project Plan Editor (can commit project changes)
- Project Schedule Generator (can create and commit schedules)

Public distribution is different from publishing to an organization's own
catalog. The supported route for these Teams-based packages is Partner Center
submission for Teams Store validation. Microsoft says Teams Store apps are also
listed on Microsoft commercial Marketplace after publication. Submission does
not mean approval or public availability.

## Current status (2026-11-02)

- [x] Confirm the four-agent public scope.
- [x] Update `npm run package:marketplace` to target only these four agents.
- [x] Verify its dry run lists four `package`/`validate` pairs and performs no
  tenant operations.
- [x] Provision distinct production Teams app and PDS auth identities for all
  four agents; packaged IDs match the existing Developer Portal app IDs.
- [ ] Complete external-tenant authentication and consent verification.
- [ ] Complete external-tenant security and acceptance testing.
- [x] Build and Toolkit-validate all four production packages.
- [x] Draft Partner Center testing notes; external test accounts, test results,
  and secure reviewer access remain pending.
- [x] Import the exact production ZIPs into their existing Developer Portal
  app IDs and verify app ID/version readback.
- [ ] Complete Partner Center submission and Microsoft certification.
- [ ] Verify public listings and customer installation.

All four ignored `env/.env.prod` files are configured. Production ZIPs were
built and Toolkit-validated at the source versions on 2026-11-02. Their app IDs,
names, package contents, and SHA-256 hashes are recorded in the local
`dist/production-agent-release.json`. External-tenant test evidence is not
attached to that record; do not submit the packages until the applicable
acceptance gates pass and evidence is retained. Developer Portal imports are
complete and read back at the expected IDs and versions. Partner Center
submission has not been performed.

## 1. Publisher and offer readiness

- [ ] Confirm the publisher's Partner Center account is enrolled for the
  applicable Microsoft 365/Teams Marketplace program and publisher verification
  is complete.
- [ ] Confirm the intended Partner Center offer type accepts each exact
  declarative-agent package, its remote MCP action, auth model, and intended
  Microsoft 365 experiences. Resolve eligibility questions with Microsoft
  before relying on the existing package format.
- [ ] Assign an accountable owner for the offer, certification responses,
  customer support, security issues, package updates, and retirement.
- [ ] Review the latest [Teams Store validation guidelines](https://learn.microsoft.com/en-us/microsoftteams/platform/concepts/deploy-and-publish/appsource/prepare/teams-store-validation-guidelines),
  [Teams Store publishing process](https://learn.microsoft.com/en-us/microsoftteams/platform/concepts/deploy-and-publish/appsource/publish),
  and [Marketplace certification policies](https://learn.microsoft.com/en-us/legal/marketplace/certification-policies).

**Gate:** do not proceed to public submission until Partner Center confirms the
offer type and package are eligible.

## 2. Production identity and authentication

For **each of the four agents**:

- [x] Create a distinct production Teams app ID. Do not reuse a dev app ID or
  another agent's production ID.
- [x] Register a distinct production PDS MCP authentication configuration for
  the app. Do not reuse dev auth IDs, credentials, or secrets.
- [ ] Configure authentication to work for users in customer tenants, including
  the required cross-tenant audience and consent experience. The checked-in
  development lifecycle uses `targetAudience: HomeTenant`; that is not a
  production cross-tenant configuration.
- [x] Provision production Teams app and DCR identities with
  `npm run provision:marketplace -- --execute --confirm-production`. The
  dry-run is `npm run provision:marketplace`; execution uses the isolated
  `production-provision/m365agents.yml` lifecycles and records completed IDs in
  the ignored provisioning journal. This creates identities only and does not
  complete the external-tenant acceptance gate.
- [ ] Confirm required delegated Microsoft Graph permissions, OAuth redirect
  behavior, token exchange/OBO, consent, and revocation with the identity and
  service owners.
- [ ] Verify the PDS service enforces tenant/user authorization and data
  isolation server-side. Agent instructions and package metadata are not an
  authorization boundary.
- [ ] Store production configuration only in approved secret/configuration
  systems or ignored local `env/.env.prod` files. Never commit or include
  credentials in a package or release artifact.

Use the approved provisioning/deployment workflow for production identity and
service configuration. Do not make direct production infrastructure changes
from this checklist run.

**Gate:** an external-tenant user must be able to complete the documented
sign-in and consent flow without access to another customer's data.

## 3. External-tenant security and acceptance

Use a non-admin test account in a tenant outside the publisher's tenant. Test
each package independently and retain sanitized test evidence.

For all four:

- [ ] Install and launch from the intended Microsoft 365 experience.
- [ ] Complete OAuth sign-in and consent; verify expected behavior when consent
  is denied, revoked, expired, or required again.
- [ ] Verify project selection, file access, paging, session expiry/recovery,
  errors, and data isolation for the signed-in user.
- [ ] Verify no credentials, tokens, signed URLs, or another tenant's data are
  disclosed in responses or logs.
- [ ] Confirm the live service supports the exact production package and MCP
  endpoint.

For Project Manager Assistant and MPP Data Auditor:

- [ ] Verify that requests cannot modify, commit, upload, or delete project data.
- [ ] Verify their tool access is read-only at the service authorization layer,
  not only restricted by instructions.

For Project Plan Editor and Project Schedule Generator:

- [ ] Verify every write is authorized server-side for the signed-in user and
  selected project; the agent prompt must not be the sole write safeguard.
- [ ] Verify a clear user request is required and ambiguous targets or missing
  inputs do not produce writes.
- [ ] Exercise denied, invalid, duplicate/retried, expired-session, partial
  failure, and failed-commit cases. Confirm no unintended or duplicate writes.
- [ ] Verify successful writes by reading back the persisted result and
  reporting the actual outcome.

**Gate:** block public submission for any agent until the applicable cases pass.
In particular, do not submit Editor or Generator while write authorization and
failure behavior remain unverified in an external tenant.

## 4. Listing and customer setup materials

Prepare accurate, agent-specific listing content and ensure it matches the
tested package:

- [ ] Unique public name, concise description, supported use cases, and
  differentiated value for each agent.
- [ ] Icons, screenshots, and other Partner Center-required media.
- [ ] Publisher contact, support URL/contact, privacy statement, and terms of use.
- [ ] Supported regions, experiences, prerequisites, licensing, and any
  additional costs.
- [ ] Clear customer instructions for installation, Microsoft 365 permissions,
  OAuth consent, connecting to PDS, and selecting project files.
- [ ] Disclose external services, what data is accessed and why, data handling
  and retention, known limitations, and how customers get support.
- [ ] Review product names, trademarks, and listing claims against current
  Marketplace policies.
- [x] Draft shared setup and four separate agent test procedures in the
  [shared guide](partner-center-testing-notes.md) and its
  [per-agent notes](partner-center-testing/).
- [ ] Provide certification reviewers with reproducible test instructions and
  working test access through Partner Center's requested secure process.

## 5. Build and verify the production artifacts

From the `external/pds-project-ai-assets` repository root:

- [x] Resolve the asset validation failures and confirm `npm test` passes.
- [x] Confirm the four production app IDs and PDS auth IDs have been created,
  are unique, and differ from the dev identities.
- [x] Create each package's ignored `env/.env.prod` with `TEAMSFX_ENV=prod`,
  an empty `APP_NAME_SUFFIX`, and that package's production app/auth IDs.
- [x] Run `npm run package:marketplace` and review the four-agent plan.
- [x] Run `npm run package:marketplace -- --prepare` to inspect production
  templates without tenant calls.
- [x] Build and Toolkit-validate with
  `npm run package:marketplace -- --execute --external-tenant-verified` after
  the operator authorized proceeding. This flag is an operator acknowledgment;
  external-test evidence is still required before submission.
- [x] Inspect each `apps/<agent>/appPackage/build/appPackage.prod.zip`: verify
  app ID, version, branding, PDS endpoint, auth reference, included files,
  capabilities, and absence of dev identities or secrets.
- [x] Record source commit and dirty-tree state, app ID, version, SHA-256, and
  validation output for each exact ZIP.
- [ ] Attach retained external-tenant test evidence to the release record.
- [x] Freeze and retain these exact ZIPs for submission. Do not rebuild or
  change package contents after testing without a new version and repeat tests.
- [x] Synchronize each existing Developer Portal app definition from its exact
  tested ZIP, preserving the app ID. Read back the app ID and version and stop
  if either does not match the ZIP.

`package:marketplace --execute` only packages and validates locally. It does
not provision production identities, deploy the service, upload packages, or
submit offers.

## 6. Submit and complete certification

For each eligible agent:

- [ ] In Partner Center, create or update the supported Teams/Microsoft 365
  Marketplace offer and enter its listing and technical information.
- [ ] Confirm the existing Developer Portal app ID and version still match the
  exact tested ZIP before upload; stop if synchronization or readback failed.
- [ ] Upload the exact tested production package and provide reviewer
  instructions/access as requested.
- [ ] Review the full offer and submit it for certification.
- [ ] Record offer ID, package version, submission date, owner, and current
  review status.
- [ ] Monitor the review. If Microsoft requests changes, update the source,
  increment the version, rebuild, revalidate, repeat affected security tests,
  and resubmit the new artifact.
- [ ] Do not describe a submission in review as published.

Follow the applicable submission method shown in the current
[Partner Center publishing guidance](https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/publish-plugin-publicly)
and the Teams Store publishing process. If Partner Center does not offer a
submission type that accepts this exact package, stop and resolve the supported
offer type with Microsoft; do not substitute a tenant catalog upload.

## 7. Verify launch and operate

- [ ] After approval, verify each offer is publicly available on Microsoft
  Marketplace/Teams Store and that listing details match the approved version.
- [ ] Verify discoverability and installation in a customer tenant; public
  listing alone does not guarantee every organization's admin enables the app.
- [ ] Complete any customer-side admin enablement, user assignment, app
  installation, OAuth consent, or PDS connection steps.
- [ ] Record the public listing URL, offer ID, version, publication date, and
  verification result.
- [ ] Monitor certification notices, support requests, usage, security reports,
  and service health; maintain an update and retirement process.

## What can be automated

- **Automate in CI:** asset validation, package generation, Toolkit package
  validation, release metadata, ZIP hashes, and a reviewable release report.
- **Keep approval-gated:** production identity/configuration changes, external
  tenant security acceptance, final listing review, Partner Center submission,
  certification responses, and confirmation of public availability.
- **Do not automate by UI scripting:** MFA, policy acknowledgements, reviewer
  access decisions, or final publication approval.

The existing tenant `publish:agents` browser automation is for the development
portal/catalog workflow. It is not the public Partner Center submission path.
