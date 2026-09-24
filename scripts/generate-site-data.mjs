import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const rootPath = fileURLToPath(new URL("../", import.meta.url));
const catalog = JSON.parse(readFileSync(join(rootPath, "catalog.json"), "utf8"));
const packageRoot = join(rootPath, "build", "agent-packages");
const outputPath = join(rootPath, "site", "src", "lib", "generated", "catalog.json");

function toPascalCase(value) {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => `${part[0].toUpperCase()}${part.slice(1)}`)
    .join("");
}

function readUtf8(path) {
  return readFileSync(path, "utf8").replaceAll("\r\n", "\n");
}

if (!existsSync(packageRoot)) {
  throw new Error("Missing build/agent-packages; run npm run package:agents first");
}

const skillsByName = new Map(catalog.skills.map((skill) => [skill.name, skill]));
const agents = catalog.agents.map((agent) => {
  const sourceRoot = join(rootPath, agent.path);
  const packagePath = join(packageRoot, agent.name);
  const metadata = JSON.parse(readUtf8(join(sourceRoot, "agent.json")));
  const skills = metadata.skills.map((name) => {
    const skill = skillsByName.get(name);
    if (!skill) {
      throw new Error(`Agent ${agent.name} references missing catalog skill ${name}`);
    }
    return {
      name,
      category: skill.category,
      access: skill.access,
      content: readUtf8(join(packagePath, "skills", name, "SKILL.md"))
    };
  });

  return {
    ...metadata,
    authoringTargets: agent.authoringTargets,
    packageFile: `PDS${toPascalCase(agent.name)}.zip`,
    instructions: readUtf8(join(packagePath, "instructions.md")),
    setupGuide: readUtf8(join(packagePath, "README.md")),
    agentTemplate: existsSync(join(packagePath, "agent.yaml"))
      ? readUtf8(join(packagePath, "agent.yaml"))
      : null,
    skills
  };
});

mkdirSync(join(outputPath, ".."), { recursive: true });
writeFileSync(
  outputPath,
  `${JSON.stringify({
    product: catalog.product,
    catalogVersion: catalog.catalogVersion,
    mcpContractVersion: catalog.mcpContractVersion,
    agents
  }, null, 2)}\n`,
  "utf8"
);

console.log(`Generated website data for ${agents.length} agents at ${outputPath}.`);