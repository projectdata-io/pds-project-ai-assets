# Contributing

## Principles

1. Keep every asset focused on one recognizable user outcome.
2. Reference only MCP tools and arguments supported by the released PDS Project AI contract.
3. Separate observation from inference and include entity identifiers as evidence.
4. Never let an analysis workflow silently perform an edit.
5. For edit workflows, use capability discovery, draft creation, preview, validation, explicit confirmation, and commit in that order.
6. Create one parsing session per source file, reuse it during the workflow, and close it when finished.
7. Use synthetic examples. Do not commit customer data, credentials, tenant identifiers, private URLs, or proprietary MPP files.
8. Document only released, publicly supported behavior. Do not publish roadmap capabilities, internal service names, storage layouts, infrastructure identifiers, private limits, or implementation-only retry behavior.

## Adding an asset

1. Copy the matching file from `templates/`.
2. Place it in the appropriate top-level collection.
3. Use lowercase kebab-case for directory and file names.
4. Write a keyword-rich description that states both what the asset does and when it should be used.
5. Document required MCP tools, scopes, inputs, output shape, failure behavior, and non-goals.
6. Add representative synthetic examples and tests where behavior is deterministic.
7. Run `npm test`.

## Public release review

Before opening a pull request:

1. Confirm every named tool, argument, field, and scope exists in the released public contract.
2. Replace organization, tenant, user, project, and file identifiers with clearly synthetic values.
3. Remove local paths, private hostnames, infrastructure names, diagnostic dumps, and copied production responses.
4. Confirm no `.mpp`, credential, certificate, environment, log, or generated output file is included.
5. Review the complete Git diff, including binary files, before publishing.
6. Run `npm test` and the repository's secret-scanning checks.

## Skill structure

```text
skills/<skill-name>/
├── SKILL.md
├── references/     # optional
├── scripts/        # optional
└── assets/         # optional
```

The `name` in `SKILL.md` frontmatter must exactly match its containing directory.

## Compatibility

When an asset depends on a newly introduced or changed MCP capability, update its compatibility section and examples in the same pull request. Do not describe unavailable product behavior as implemented.