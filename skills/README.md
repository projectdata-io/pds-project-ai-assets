# Skills

Each child directory contains one reusable workflow with a `SKILL.md` whose frontmatter `name` matches the directory name. Optional supporting material belongs beside it in `references`, `scripts`, or `assets`.

Use [the skill template](../templates/skill/SKILL.template.md) to start a new skill.

Declare every PDS MCP tool referenced in the Workflow section in both the skill's Tools line and its catalog entry. `npm test` checks workflow references as well as metadata, access boundaries, and generated bundles. External Work IQ capabilities are declared separately; a SharePoint report/list write is not an MPP edit.

Authoring workflows must reuse supplied drafts without duplicating operations and pass draft IDs and cleanup ownership to commit workflows. Source-file updates require verified provider write-back; a session-only commit does not update the source file. When external outcome writes fail after a successful commit, reconcile those outcomes without replaying project changes.