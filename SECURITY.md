# Security Policy

## Reporting a vulnerability

Report security vulnerabilities privately through GitHub Security Advisories for this repository. Do not open a public issue containing exploit details, credentials, customer data, or private service URLs.

## Asset safety

Contributions must not contain secrets, access tokens, connection strings, tenant identifiers, customer project data, or links that grant access to private files. Examples must use synthetic values and reserved domains such as `example.com`.

Do not publish unreleased product capabilities, internal service or storage names, infrastructure identifiers, private operational limits, local filesystem paths, diagnostic dumps, or implementation details that are absent from the released public contract.

Repository administrators should enable GitHub secret scanning and push protection. The local validator and `.gitignore` provide additional safeguards but do not replace repository-level protection or human review.