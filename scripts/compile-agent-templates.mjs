import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const rootPath = fileURLToPath(new URL("../", import.meta.url));
const outputRoot = join(rootPath, "build", "agent-templates");
const checkOnly = process.argv.includes("--check");
const catalog = JSON.parse(readFileSync(join(rootPath, "catalog.json"), "utf8"));
const connectorId =
  process.env.PDS_AGENT_CONNECTOR_ID ??
  "/providers/Microsoft.PowerApps/apis/shared_pds-5fpds-20project-20data-20ai-5f716d2307fe043200";
const connectionId = process.env.PDS_AGENT_CONNECTION_ID ?? "__PDS_CONNECTION_ID__";
const customConnectorId = process.env.PDS_AGENT_CUSTOM_CONNECTOR_ID ?? "__PDS_CUSTOM_CONNECTOR_ID__";

function toPascalCase(value) {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => `${part[0].toUpperCase()}${part.slice(1)}`)
    .join("");
}

function deterministicGuid(value) {
  const hash = createHash("sha256").update(value).digest("hex").slice(0, 32).split("");
  hash[12] = "5";
  hash[16] = ((Number.parseInt(hash[16], 16) & 0x3) | 0x8).toString(16);
  const compact = hash.join("");
  return `${compact.slice(0, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}-${compact.slice(16, 20)}-${compact.slice(20)}`;
}

function yamlString(value) {
  return JSON.stringify(value);
}

function indentBlock(value, spaces) {
  const prefix = " ".repeat(spaces);
  return value.replaceAll("\r\n", "\n").trim().split("\n").map((line) => `${prefix}${line}`).join("\n");
}

function skillSource(skillName) {
  return readFileSync(join(rootPath, "skills", skillName, "SKILL.md"), "utf8").replaceAll("\r\n", "\n").trim();
}

function skillDescription(skillName) {
  const source = skillSource(skillName);
  const raw = source.match(/^description:\s*(.+)$/m)?.[1]?.trim();
  if (!raw) {
    throw new Error(`Skill ${skillName} has no description`);
  }
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    return raw.slice(1, -1);
  }
  return raw;
}

function renderSkillComponent(agentSchema, agentName, skillName) {
  const description = skillDescription(skillName);
  const id = deterministicGuid(`${agentName}:skill:${skillName}`);
  return `  - kind: DialogComponent
    displayName: ${yamlString(skillName)}
    id: ${id}
    description: ${yamlString(description)}
    shareContext:
      kind: ContentShareContext
    state: Active
    status: Active
    publisherUniqueName: pds
    schemaName: ${agentSchema}.skill.${skillName}
    dialog:
      kind: InlineAgentSkill
      skillFolderName: ${skillName}
      content: |-
${indentBlock(skillSource(skillName), 8)}
      authoringSource: Repository
`;
}

function renderSharePointMcpComponent(agentSchema, agentName) {
  const id = deterministicGuid(`${agentName}:mcp-tool:sharepoint-workiq`);
  const sharePointConnectionId = process.env.PDS_SHAREPOINT_WORKIQ_CONNECTION_ID ?? "__PDS_SHAREPOINT_WORKIQ_CONNECTION_ID__";
  const sharePointConnectorId =
    process.env.PDS_SHAREPOINT_WORKIQ_CONNECTOR_ID ??
    "/providers/Microsoft.PowerApps/apis/shared_workiqsharepointmcp";
  const connectionReference = `${agentSchema}.cr.shared_workiqsharepointmcp.${sharePointConnectionId}`;
  return `  - kind: DialogComponent
    displayName: SharePoint
    id: ${id}
    shareContext:
      kind: ContentShareContext
    state: Active
    status: Active
    publisherUniqueName: pds
    schemaName: ${agentSchema}.tool.SharePointWorkIQ
    dialog:
      kind: McpTool
      authMode: Invoker
      connectionReference: ${connectionReference}
      connectorId: ${sharePointConnectorId}
      operationId: mcp_SharePointRemoteServer
`;
}

function renderTemplate(agent, metadata) {
  const agentSchema = `pds_${toPascalCase(agent.name)}Agent`;
  const displayName = `${metadata.title} (Agent)`;
  const connectionReference = `${agentSchema}.cr.shared_pds_project_data_ai.${connectionId}`;
  const instructions = readFileSync(join(rootPath, agent.path, "instructions.md"), "utf8").replaceAll("\r\n", "\n").trim();
  const mcpId = deterministicGuid(`${agent.name}:mcp-tool`);
  const botId = deterministicGuid(`${agent.name}:bot`);
  const componentId = deterministicGuid(`${agent.name}:component`);
  const connectionReferenceId = deterministicGuid(`${agent.name}:connection-reference`);
  const skills = metadata.skills.map((skillName) => renderSkillComponent(agentSchema, agent.name, skillName)).join("");
  const mcpServers = metadata.mcpServers ?? ["project"];
  const mcpComponents = mcpServers.map((server) => {
    if (server === "project") {
      return `  - kind: DialogComponent
    displayName: PDS Project Data AI
    id: ${mcpId}
    shareContext:
      kind: ContentShareContext
    state: Active
    status: Active
    publisherUniqueName: pds
    schemaName: ${agentSchema}.tool.PDSProjectDataAI
    dialog:
      kind: McpTool
      authMode: Invoker
      connectionReference: ${connectionReference}
      connectorId: ${connectorId}
      operationId: InvokeServer
`;
    }
    if (server === "sharepoint-workiq") {
      return renderSharePointMcpComponent(agentSchema, agent.name);
    }
    throw new Error(`Unsupported MCP server in ${agent.name}: ${server}`);
  }).join("");

  const sharePointConnectionId = process.env.PDS_SHAREPOINT_WORKIQ_CONNECTION_ID ?? "__PDS_SHAREPOINT_WORKIQ_CONNECTION_ID__";
  const sharePointConnectorId =
    process.env.PDS_SHAREPOINT_WORKIQ_CONNECTOR_ID ??
    "/providers/Microsoft.PowerApps/apis/shared_workiqsharepointmcp";
  const sharePointConnectionReference = `${agentSchema}.cr.shared_workiqsharepointmcp.${sharePointConnectionId}`;
  const sharePointConnectionReferenceId = deterministicGuid(`${agent.name}:connection-reference:sharepoint-workiq`);
  const hasSharePoint = mcpServers.includes("sharepoint-workiq");

  return `kind: BotDefinition
components:
${mcpComponents}${skills}environmentVariables: []
flows: []
dataverseTableSearchs: []
dataverseTableSearchGlossaryConfigurations: []
dataverseTableSearchEntityConfigurations: []
dataverseTableSearchEntityColumnSynonyms: []
connectionReferences:
  - kind: ConnectionReference
    id: ${connectionReferenceId}
    connectionId: ${connectionId}
    customConnectorId: ${customConnectorId}
    connectorId: ${connectorId}
    connectionReferenceLogicalName: ${connectionReference}
    displayName: ${connectionReference}
${hasSharePoint ? `  - kind: ConnectionReference
    id: ${sharePointConnectionReferenceId}
    connectionId: ${sharePointConnectionId}
    customConnectorId: ${sharePointConnectorId}
    connectorId: ${sharePointConnectorId}
    connectionReferenceLogicalName: ${sharePointConnectionReference}
    displayName: ${sharePointConnectionReference}
` : ""}connectorDefinitions:
  - kind: ConnectorDefinition
    connectorId: ${connectorId}
    displayName: PDS Project Data AI
    description: PDS Project AI MCP server for Microsoft Project MPP analysis and controlled editing.
    isCustom: true
    connectorType: Solution
    hasPublicData: false
    isSSOSupported: false
    operations:
      - kind: ConnectorOperation
        displayName: PDS Project Data AI
        description: Invoke the PDS Project Data AI MCP server.
        inputType:
          kind: Record
          properties:
            error:
              kind: PropertyInfo
              order: 6
              type:
                kind: Any
            id:
              kind: PropertyInfo
              order: 2
              type:
                kind: String
            jsonrpc:
              kind: PropertyInfo
              order: 1
              type:
                kind: String
            Mcp-Session-Id:
              kind: PropertyInfo
              displayName: Session Id
              order: 0
              type:
                kind: String
            method:
              kind: PropertyInfo
              order: 3
              type:
                kind: String
            params:
              kind: PropertyInfo
              order: 4
              type:
                kind: Any
            result:
              kind: PropertyInfo
              order: 5
              type:
                kind: Any
        outputType:
          kind: String
        operationId: InvokeServer
${hasSharePoint ? `  - kind: ConnectorDefinition
    connectorId: ${sharePointConnectorId}
    displayName: SharePoint MCP (Work IQ)
    description: Work IQ SharePoint MCP connector for configured portfolio-list maintenance.
    isCustom: false
    connectorType: Solution
    hasPublicData: false
    isSSOSupported: false
    operations:
      - kind: ConnectorOperation
        displayName: SharePoint MCP (Work IQ)
        description: Invoke the Work IQ SharePoint MCP connector.
        inputType:
          kind: Record
          properties:
            error:
              kind: PropertyInfo
              order: 6
              type:
                kind: Any
            id:
              kind: PropertyInfo
              order: 2
              type:
                kind: String
            jsonrpc:
              kind: PropertyInfo
              order: 1
              type:
                kind: String
            Mcp-Session-Id:
              kind: PropertyInfo
              displayName: Session Id
              order: 0
              type:
                kind: String
            method:
              kind: PropertyInfo
              order: 3
              type:
                kind: String
            params:
              kind: PropertyInfo
              order: 4
              type:
                kind: Any
            result:
              kind: PropertyInfo
              order: 5
              type:
                kind: Any
        outputType:
          kind: String
        operationId: mcp_SharePointRemoteServer
` : ""}aIModelDefinitions: []
aIPluginOperations: []
connectedAgentDefinitions: []
componentCollections: []
connectedBots: []
diagnostics: []
entity:
  kind: BotEntity
  displayName: ${yamlString(displayName)}
  schemaName: ${agentSchema}
  componentIdUnique: ${componentId}
  cdsBotId: ${botId}
  accessControlPolicy: GroupMembership
  authenticationMode: Integrated
  authenticationTrigger: Always
  configuration:
    kind: BotConfiguration
    recognizer:
      kind: CLICopilotRecognizer
      diagnostics: []
    authoringModel: CliCopilot
    syntax:
      Elements:
        - PropertyName: authoringModel
        - PropertyName: recognizer
        - PropertyName: agentSettings
    agentSettings:
      kind: AgentSettings
      version: "1.0"
      model:
        series: Sonnet46
      instructions:
        segments:
          - kind: StaticSegment
            value: |-
${indentBlock(instructions, 14)}
      conversationStarters: []
  template: cliagent-1.0.0
  language: 1033
  runtimeProvider: PowerVirtualAgents
  state: Active
  status: 1
`;
}

function collectFiles(directory) {
  if (!existsSync(directory)) {
    return [];
  }
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(path));
    } else {
      files.push(path);
    }
  }
  return files;
}

const expectedFiles = new Map();
for (const agent of catalog.agents.filter((item) => item.authoringTargets.includes("agent"))) {
  const metadata = JSON.parse(readFileSync(join(rootPath, agent.path, "agent.json"), "utf8"));
  expectedFiles.set(join("build", "agent-templates", `${agent.name}.yaml`), renderTemplate(agent, metadata));
}

if (checkOnly) {
  const actualFiles = collectFiles(outputRoot).map((path) => relative(rootPath, path));
  const stale = [];
  for (const [repositoryPath, expected] of expectedFiles) {
    const path = join(rootPath, repositoryPath);
    if (!existsSync(path) || readFileSync(path, "utf8").replaceAll("\r\n", "\n") !== expected) {
      stale.push(repositoryPath.replaceAll("\\", "/"));
    }
  }
  const unexpected = actualFiles.filter((path) => !expectedFiles.has(path));
  if (stale.length || unexpected.length) {
    stale.forEach((path) => console.error(`Missing or stale Agent template: ${path}`));
    unexpected.forEach((path) => console.error(`Unexpected Agent template: ${path.replaceAll("\\", "/")}`));
    process.exitCode = 1;
  } else {
    console.log(`Agent templates are current (${expectedFiles.size} agents).`);
  }
} else {
  rmSync(outputRoot, { recursive: true, force: true });
  mkdirSync(outputRoot, { recursive: true });
  for (const [repositoryPath, content] of expectedFiles) {
    writeFileSync(join(rootPath, repositoryPath), content, "utf8");
  }
  console.log(`Compiled Agent templates for ${expectedFiles.size} agents.`);
}
