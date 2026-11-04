import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseEnv } from "node:util";

const rootPath = fileURLToPath(new URL("../", import.meta.url));
const journalPath = join(rootPath, "dist", "production-agent-provisioning.json");
export const productionPackages = [
  { slug: "teams-project-manager-assistant", dcrEnvironmentVariable: "MCP_DA_AUTH_ID_PROJECT_MANAGER_ASSISTANT" },
  { slug: "teams-mpp-data-auditor", dcrEnvironmentVariable: "MCP_DA_AUTH_ID_MPP_DATA_AUDITOR" },
  { slug: "teams-project-plan-editor", dcrEnvironmentVariable: "MCP_DA_AUTH_ID_PROJECT_PLAN_EDITOR" },
  { slug: "teams-project-schedule-generator", dcrEnvironmentVariable: "MCP_DA_AUTH_ID_PROJECT_SCHEDULE_GENERATOR" }
];

const requiredProductionDefaults = { TEAMSFX_ENV: "prod", APP_NAME_SUFFIX: "" };

export function getProductionIdentityState(packageInfo, production, development) {
  const appId = typeof production.TEAMS_APP_ID === "string" ? production.TEAMS_APP_ID.trim() : "";
  const dcrId = typeof production[packageInfo.dcrEnvironmentVariable] === "string"
    ? production[packageInfo.dcrEnvironmentVariable].trim()
    : "";
  const hasAppId = appId.length > 0;
  const hasDcrId = dcrId.length > 0;

  if (hasAppId !== hasDcrId) {
    throw new Error(`${packageInfo.slug} has partial production identity output; inspect the app and DCR before continuing.`);
  }
  if (hasAppId && (appId === development.TEAMS_APP_ID || dcrId === development[packageInfo.dcrEnvironmentVariable])) {
    throw new Error(`${packageInfo.slug} production identity must not reuse its dev app or DCR ID.`);
  }

  return {
    status: hasAppId ? "provisioned" : "pending",
    fingerprint: hasAppId ? createHash("sha256").update(`${appId}\0${dcrId}`).digest("hex") : undefined
  };
}

export function assertUniqueProductionIdentities(records) {
  const appIds = new Set();
  const dcrIds = new Set();
  for (const record of records) {
    if (!record.appId || !record.dcrId) continue;
    if (appIds.has(record.appId) || dcrIds.has(record.dcrId)) {
      throw new Error(`Production identities must be unique; duplicate identity found for ${record.slug}.`);
    }
    appIds.add(record.appId);
    dcrIds.add(record.dcrId);
  }
}

export function validateProductionLifecycle(contents, packageInfo) {
  const actions = [...contents.matchAll(/^\s*-\s+uses:\s*(\S+)/gm)].map((match) => match[1]);
  if (actions.length !== 2 || actions[0] !== "teamsApp/create" || actions[1] !== "dcr/register") {
    throw new Error(`${packageInfo.slug} production lifecycle must only create the Teams app and DCR.`);
  }
  if (!/^\s+targetAudience:\s*AnyTenant\s*$/m.test(contents) ||
      !contents.includes(`configurationId: ${packageInfo.dcrEnvironmentVariable}`)) {
    throw new Error(`${packageInfo.slug} production lifecycle must target AnyTenant and write its package-local DCR ID.`);
  }
}

function parseArguments(args) {
  const allowed = new Set(["--execute", "--confirm-production", "--help"]);
  for (const arg of args) {
    if (!allowed.has(arg)) throw new Error(`Unknown argument: ${arg}`);
  }
  return {
    execute: args.includes("--execute"),
    confirmProduction: args.includes("--confirm-production"),
    help: args.includes("--help")
  };
}

export function validateExecutionIntent(options) {
  if (options.execute !== options.confirmProduction) {
    throw new Error("Production provisioning is dry-run by default; use both --execute and --confirm-production to create production identities.");
  }
}

function loadEnv(path) {
  return existsSync(path) ? parseEnv(readFileSync(path, "utf8")) : {};
}

function ensureProductionDefaults(path, existing) {
  const missing = [];
  for (const [name, expected] of Object.entries(requiredProductionDefaults)) {
    if (existing[name] === undefined) {
      missing.push(`${name}=${expected}`);
    } else if (existing[name] !== expected) {
      throw new Error(`${path} must set ${name}=${expected}.`);
    }
  }

  if (missing.length === 0) return;
  if (!existsSync(path)) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${missing.join("\n")}\n`, { mode: 0o600 });
    return;
  }

  const original = readFileSync(path, "utf8");
  appendFileSync(path, `${original.endsWith("\n") || original.length === 0 ? "" : "\n"}${missing.join("\n")}\n`);
}

function readJournal() {
  if (!existsSync(journalPath)) return { schemaVersion: 1, packages: {} };
  const journal = JSON.parse(readFileSync(journalPath, "utf8"));
  if (journal.schemaVersion !== 1 || !journal.packages || typeof journal.packages !== "object" || Array.isArray(journal.packages)) {
    throw new Error("Production provisioning journal is invalid; inspect it before continuing.");
  }
  return journal;
}

function saveJournal(journal) {
  mkdirSync(dirname(journalPath), { recursive: true });
  const temporaryPath = `${journalPath}.tmp`;
  writeFileSync(temporaryPath, `${JSON.stringify(journal, null, 2)}\n`, { mode: 0o600 });
  renameSync(temporaryPath, journalPath);
}

function inspectPackages(journal) {
  const plans = productionPackages.map((packageInfo) => {
    const packagePath = join(rootPath, "apps", packageInfo.slug);
    const lifecyclePath = join(packagePath, "production-provision", "m365agents.yml");
    const devPath = join(packagePath, "env", ".env.dev");
    const productionPath = join(packagePath, "env", ".env.prod");
    if (!existsSync(lifecyclePath) || !existsSync(devPath)) {
      throw new Error(`${packageInfo.slug} is missing its production lifecycle or dev environment.`);
    }
    validateProductionLifecycle(readFileSync(lifecyclePath, "utf8"), packageInfo);

    const development = loadEnv(devPath);
    const production = loadEnv(productionPath);
    const identity = getProductionIdentityState(packageInfo, production, development);
    const journalEntry = journal.packages[packageInfo.slug];
    if (journalEntry && !["started", "provisioned"].includes(journalEntry.status)) {
      throw new Error(`${packageInfo.slug} has an invalid provisioning journal stage.`);
    }
    if (journalEntry?.status === "started") {
      throw new Error(`${packageInfo.slug} has an uncertain prior provision attempt; inspect the tenant before retrying.`);
    }
    if (journalEntry?.status === "provisioned") {
      if (identity.status !== "provisioned" || identity.fingerprint !== journalEntry.identityFingerprint) {
        throw new Error(`${packageInfo.slug} production identity differs from the completed journal entry.`);
      }
    } else if (identity.status === "provisioned") {
      throw new Error(`${packageInfo.slug} already has production IDs without a completed journal; inspect them before continuing.`);
    }

    return {
      ...packageInfo,
      packagePath,
      productionPath,
      production,
      identity,
      action: journalEntry?.status === "provisioned" ? "skip" : "provision"
    };
  });

  assertUniqueProductionIdentities(plans.map((plan) => ({
    slug: plan.slug,
    appId: plan.production.TEAMS_APP_ID,
    dcrId: plan.production[plan.dcrEnvironmentVariable]
  })));
  return plans;
}

function runToolkit(plan) {
  const result = spawnSync("npx", [
    "--yes", "@microsoft/m365agentstoolkit-cli@beta", "provision",
    "--folder", "./production-provision", "--env", "prod", "--interactive", "false"
  ], {
    cwd: plan.packagePath,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, ATK_CLI_SKILL: "true" }
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${plan.slug} production provisioning failed; later agents were not changed.`);
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    console.log("Usage: npm run provision:marketplace [--execute --confirm-production]");
    return;
  }
  validateExecutionIntent(options);

  const journal = readJournal();
  const plans = inspectPackages(journal);
  for (const plan of plans) {
    console.log(`${plan.slug}: ${plan.action === "skip" ? "already provisioned and verified" : `ATK provision --folder ./production-provision --env prod${existsSync(plan.productionPath) ? "" : " (will initialize ignored env/.env.prod)"}`}`);
  }
  if (!options.execute) {
    console.log("Dry run only: no env files created and no Microsoft tenant calls made.");
    return;
  }

  for (const plan of plans) {
    if (plan.action === "skip") continue;
    ensureProductionDefaults(plan.productionPath, plan.production);
  }

  for (const plan of plans) {
    if (plan.action === "skip") continue;
    journal.packages[plan.slug] = { status: "started" };
    saveJournal(journal);
    runToolkit(plan);

    const production = loadEnv(plan.productionPath);
    const identity = getProductionIdentityState(plan, production, loadEnv(join(plan.packagePath, "env", ".env.dev")));
    if (identity.status !== "provisioned") {
      throw new Error(`${plan.slug} completed without writing both production IDs; inspect the tenant before retrying.`);
    }
    journal.packages[plan.slug] = { status: "provisioned", identityFingerprint: identity.fingerprint };
    saveJournal(journal);
    plan.production = production;
  }

  assertUniqueProductionIdentities(plans.map((plan) => ({
    slug: plan.slug,
    appId: plan.production.TEAMS_APP_ID,
    dcrId: plan.production[plan.dcrEnvironmentVariable]
  })));
  console.log(`Production Teams app and DCR identities provisioned. No package upload or Partner Center submission performed. Journal: ${journalPath}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(`Production provisioning failed: ${error instanceof Error ? error.message : String(error)}\nNo automatic retry or rollback was attempted.`);
    process.exitCode = 1;
  });
}