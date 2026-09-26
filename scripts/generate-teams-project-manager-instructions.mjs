import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const rootPath = fileURLToPath(new URL("../", import.meta.url));
const checkOnly = process.argv.includes("--check");
const agentPath = join(rootPath, "agents", "copilot-studio", "project-manager-assistant");
const outputPath = join(rootPath, "apps", "teams-project-manager-assistant", "appPackage", "instruction.txt");

function withoutFrontmatter(value) {
  return value.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n*/, "").trim();
}

function frontmatterValue(value, key) {
  const raw = value.match(new RegExp(`^${key}:\\s*(.+)$`, "m"))?.[1]?.trim();
  if (!raw) {
    throw new Error(`Skill is missing ${key} frontmatter`);
  }
  return raw.replace(/^['"]|['"]$/g, "");
}

function sectionBullets(value, heading, maximum) {
  const section = value.match(new RegExp(`^## ${heading}\\r?\\n([\\s\\S]*?)(?=^## |\\s*$)`, "m"))?.[1] ?? "";
  return section
    .split(/\r?\n/)
    .filter((line) => line.startsWith("- "))
    .slice(0, maximum)
    .map((line) => line.slice(2).trim());
}

const metadata = JSON.parse(readFileSync(join(agentPath, "agent.json"), "utf8"));
const baseInstructions = readFileSync(join(agentPath, "instructions.md"), "utf8").replaceAll("\r\n", "\n").trim();
const skills = metadata.skills.map((skillName) => {
  const skillPath = join(rootPath, "skills", skillName, "SKILL.md");
  if (!existsSync(skillPath)) {
    throw new Error(`Missing Project Manager Assistant skill: ${skillName}`);
  }

  const source = readFileSync(skillPath, "utf8").replaceAll("\r\n", "\n");
  const useWhen = sectionBullets(withoutFrontmatter(source), "Use When", 2);
  return {
    name: skillName,
    description: frontmatterValue(source, "description"),
    useWhen
  };
});

const workflowRouter = skills
  .map(({ name, description, useWhen }) => {
    const triggers = useWhen.length ? ` Triggers: ${useWhen.join(" ")}` : "";
    return `- **${name}**: ${description}${triggers}`;
  })
  .join("\n");

const output = `${baseInstructions}

## Microsoft 365 Plan Selection

When the user requests plan analysis without a supplied session, OneDrive or SharePoint \`driveId\` and \`itemId\`, or an authorized HTTPS MPP reference, call \`open_project_plan_picker\` first. The embedded picker returns a confirmed \`driveId\`, \`itemId\`, and \`fileName\`; use that reference only with \`create_session_from_onedrive\`. Do not ask the user to upload an MPP file to chat, alter the picker reference, infer a URL, or call the picker browse tools outside the embedded picker flow.

## Workflow Execution

Choose the narrowest workflow below. The Microsoft 365 plan-selection rule overrides source acquisition when the user has not supplied an authorized source. Reuse caller-owned sessions. For a session created in this turn, close it after the response. Use \`get_entity_schema\` before retrying a rejected field, page every required collection, cite task/resource/assignment UIDs, state the status-date basis, and disclose missing data, partial pages, and calculations. Never infer missing values as zero or perform edits.

## Workflow Router

${workflowRouter}
`;

if (output.length > 8000) {
  throw new Error(`Generated Microsoft 365 instructions exceed the 8,000-character platform limit (${output.length}).`);
}

if (checkOnly) {
  if (!existsSync(outputPath) || readFileSync(outputPath, "utf8").replaceAll("\r\n", "\n") !== output) {
    console.error("Teams Project Manager Assistant instructions are missing or stale.");
    process.exitCode = 1;
  } else {
    console.log("Teams Project Manager Assistant instructions are current.");
  }
} else {
  writeFileSync(outputPath, output, "utf8");
  console.log(`Generated ${metadata.skills.length} Project Manager Assistant workflow contracts.`);
}