import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, realpathSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { strFromU8, unzipSync } from "fflate";
import { chromium, type Locator, type Page } from "playwright";

const root = fileURLToPath(new URL("../", import.meta.url));
const portalUrl = "https://dev.teams.microsoft.com/apps";
const adminUrl = "https://admin.teams.microsoft.com/policies/manage-apps";
export const agents = [
  { name: "manager", slug: "teams-project-manager-assistant", appId: "95cfebc6-52e0-40e6-baf5-8eca86296294", catalogId: "d55007d3-2462-4220-b49d-d3d0a53c6706" },
  { name: "auditor", slug: "teams-mpp-data-auditor", appId: "0dfe62e8-d6e4-4fb4-8a56-0857ff7e9429", catalogId: "f2fa1cf6-2b2e-4e8e-9076-0d644b0390a4" },
  { name: "editor", slug: "teams-project-plan-editor", appId: "059b5e72-6316-4923-9e44-6caa1d35c3a3", catalogId: "f3641cad-95d3-4b4d-bfc0-ba6634033647" },
  { name: "generator", slug: "teams-project-schedule-generator", appId: "baa80813-72b0-42b1-8979-b658da6458e4", catalogId: "0fe374ef-bd19-4a38-baa4-8a645f67f2ce" }
] as const;
type Agent = (typeof agents)[number];
type Artifact = Agent & { version: string; sha256: string; path: string; buffer: Buffer };
type Stage = { status: "pending" | "upload-started" | "verified" | "already-current"; checkedAt?: string };
type Entry = { name: string; appId: string; catalogId: string; version: string; sha256: string; path: string; portal: Stage; catalog: Stage };
type Journal = { schema: 1; source: { repository: string; assets: string }; entries: Entry[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseObject(json: string): Record<string, unknown> {
  const value: unknown = JSON.parse(json);
  if (!isRecord(value)) throw new Error("Expected a JSON object.");
  return value;
}

export function selectAgents(value: string | undefined): Agent[] {
  const names = value?.split(",") ?? agents.map((agent) => agent.name);
  if (!names.length || new Set(names).size !== names.length) throw new Error("Select distinct active agent names.");
  return names.map((name) => {
    const agent = agents.find((candidate) => candidate.name === name);
    if (!agent) throw new Error(`Unknown or inactive agent: ${name}. Use manager,auditor,editor,generator.`);
    return agent;
  });
}

export function inspectArtifact(agent: Agent, path: string, buffer: Buffer, sourceVersion: string): Artifact {
  if (buffer.length > 10 * 1024 * 1024) throw new Error(`${agent.name}: package exceeds 10 MiB.`);
  const entries = unzipSync(buffer, {
    filter: (entry) => {
      if (entry.originalSize > 1024 * 1024) throw new Error(`${agent.name}: oversized ZIP entry ${entry.name}.`);
      return entry.name === "manifest.json" || entry.name === "declarativeAgent.json";
    }
  });
  if (!entries["manifest.json"] || !entries["declarativeAgent.json"]) {
    throw new Error(`${agent.name}: missing packaged manifest or declarative agent.`);
  }
  const manifest = parseObject(strFromU8(entries["manifest.json"]));
  const declarativeAgent = parseObject(strFromU8(entries["declarativeAgent.json"]));
  if (manifest.id !== agent.appId) throw new Error(`${agent.name}: ZIP app ID does not match the existing app.`);
  if (typeof manifest.version !== "string" || !/^\d+\.\d+\.\d+$/.test(manifest.version) || manifest.version !== sourceVersion) {
    throw new Error(`${agent.name}: ZIP version must match source-metadata.json.`);
  }
  if (typeof declarativeAgent.instructions !== "string" || !declarativeAgent.instructions.trim() || declarativeAgent.instructions.startsWith("$")) {
    throw new Error(`${agent.name}: instructions must be inlined by packaging.`);
  }
  return { ...agent, path, buffer, version: manifest.version, sha256: createHash("sha256").update(buffer).digest("hex") };
}

function loadArtifact(agent: Agent): Artifact {
  const app = join(root, "apps", agent.slug);
  const path = join(app, "appPackage", "build", "appPackage.dev.zip");
  const metadata = parseObject(readFileSync(join(app, "source-metadata.json"), "utf8"));
  if (typeof metadata.version !== "string") throw new Error(`${agent.name}: missing source version.`);
  return inspectArtifact(agent, path, readFileSync(path), metadata.version);
}

export function readVersion(text: string, surface: "portal" | "catalog", appId: string): string {
  if (!text.toLowerCase().includes(appId.toLowerCase())) throw new Error(`${surface}: expected app ID ${appId} is absent.`);
  const versions = surface === "catalog"
    ? [...text.matchAll(/Published version\s+(\d+\.\d+\.\d+)\b/gi)].map((match) => match[1])
    : [...text.matchAll(/\b\d+\.\d+\.\d+\b/g)].map((match) => match[0]);
  if (versions.length !== 1) throw new Error(`${surface}: cannot uniquely identify the published version.`);
  return versions[0];
}

export function needsUpload(current: string, target: string): boolean {
  const a = current.split(".").map(Number);
  const b = target.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if (a[i] > b[i]) throw new Error(`Refusing downgrade from ${current} to ${target}.`);
    if (a[i] < b[i]) return true;
  }
  return false;
}

export function reconcileJournal(previous: unknown, artifacts: Artifact[], source: Journal["source"]): Journal {
  const fresh: Journal = {
    schema: 1, source,
    entries: artifacts.map(({ name, appId, catalogId, version, sha256, path }) => ({
      name, appId, catalogId, version, sha256, path, portal: { status: "pending" }, catalog: { status: "pending" }
    }))
  };
  if (previous === undefined) return fresh;
  if (!isRecord(previous) || previous.schema !== 1 || !Array.isArray(previous.entries) ||
      !isRecord(previous.source) || typeof previous.source.repository !== "string" ||
      typeof previous.source.assets !== "string") throw new Error("Invalid release journal.");
  if (previous.entries.length !== fresh.entries.length) throw new Error("Resume with the same agent selection and journal.");
  fresh.source = { repository: previous.source.repository, assets: previous.source.assets };
  for (const entry of fresh.entries) {
    const prior: unknown = previous.entries.find((candidate: unknown) => isRecord(candidate) && candidate.name === entry.name);
    if (!isRecord(prior) || (["appId", "catalogId", "version", "sha256"] as const).some((key) => prior[key] !== entry[key])) {
      throw new Error("Journal artifacts differ. Use a new --report path for a new release; never rebuild a partial release.");
    }
    for (const surface of ["portal", "catalog"] as const) {
      const stage = prior[surface];
      if (!isRecord(stage) ||
          (stage.status !== "pending" && stage.status !== "upload-started" && stage.status !== "verified" && stage.status !== "already-current") ||
          (stage.checkedAt !== undefined && typeof stage.checkedAt !== "string")) throw new Error("Invalid journal stage.");
      entry[surface] = { status: stage.status, checkedAt: stage.checkedAt };
    }
  }
  return fresh;
}

export function assertUploadAllowed(stage: Stage): void {
  if (stage.status !== "pending") {
    throw new Error(`Stage is ${stage.status} but remote version differs. Upload outcome is uncertain; inspect the portal/catalog and journal manually. No automatic reupload.`);
  }
}

function sourceState(cwd: string): string {
  const commit = spawnSync("git", ["rev-parse", "HEAD"], { cwd, encoding: "utf8", windowsHide: true });
  const status = spawnSync("git", ["status", "--porcelain"], { cwd, encoding: "utf8", windowsHide: true });
  if (commit.error || status.error || commit.status !== 0 || status.status !== 0) throw new Error(`Cannot read source provenance: ${cwd}`);
  return `${commit.stdout.trim()}${status.stdout.trim() ? " + uncommitted changes" : ""}`;
}

function saveJournal(path: string, journal: Journal): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(`${path}.tmp`, `${JSON.stringify(journal, null, 2)}\n`, { mode: 0o600 });
  renameSync(`${path}.tmp`, path);
}

async function domClick(locator: Locator): Promise<void> {
  await locator.waitFor({ state: "attached", timeout: 60000 });
  await locator.evaluate((element) => {
    if (element.hasAttribute("disabled") || element.getAttribute("aria-disabled") === "true") throw new Error("Upload control is disabled.");
    (element as HTMLElement).click();
  });
}

export async function openPortal(page: Page, artifact: Artifact): Promise<string> {
  await page.goto(portalUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.getByRole("grid").waitFor({ state: "attached", timeout: 60000 });
  const row = page.getByRole("row").filter({ hasText: artifact.appId });
  await row.waitFor({ state: "attached", timeout: 60000 });
  return readVersion(await row.innerText(), "portal", artifact.appId);
}

export function catalogState(input: { origin: string; text: string; appId: string; title?: string; authenticationFrame?: boolean }): "login" | "denied" | "chunk-failure" | "ready" | "loading" {
  if (input.origin !== "https://admin.teams.microsoft.com" ||
      input.authenticationFrame ||
      /Sign in to your account|Pick an account|Stay signed in|Approve sign.in|Request wasn.t sent|Verify your identity|Enter (?:the )?code|More information required/i.test(`${input.title ?? ""}\n${input.text}`)) return "login";
  if (/access denied|not authorized|do not have permission|don't have permission/i.test(input.text)) return "denied";
  if (/Loading chunk[\s\S]{0,100}failed|ChunkLoadError/i.test(input.text)) return "chunk-failure";
  if (input.text.toLowerCase().includes(input.appId.toLowerCase()) &&
      /Published version\s+\d+\.\d+\.\d+\b/i.test(input.text)) return "ready";
  return "loading";
}

async function readCatalogState(page: Page, appId: string): Promise<ReturnType<typeof catalogState>> {
  let authenticationFrame = false;
  for (const frame of page.frames()) {
    if (frame === page.mainFrame()) continue;
    const host = new URL(frame.url() || "about:blank").hostname;
    if (host === "login.microsoftonline.com" || host === "login.microsoft.com" || host === "login.live.com") {
      const element = await frame.frameElement();
      if (await element.isVisible()) authenticationFrame = true;
      await element.dispose();
    }
  }
  return catalogState({
    origin: new URL(page.url()).origin, text: await page.locator("body").innerText(),
    title: await page.title(), authenticationFrame, appId
  });
}

async function catalogDiagnostic(page: Page, appId: string): Promise<string> {
  const url = new URL(page.url());
  const state = await readCatalogState(page, appId);
  // Do not include page text, query strings, account names, or authentication data.
  return `page=${url.origin}${url.pathname}; state=${state}; uploadControls=${await catalogUploadControl(page).count()}. ` +
    (state === "login" ? "Use --login with the same --profile and complete sign-in/MFA." :
      state === "denied" ? "Verify the intended tenant and Teams administrator permissions." :
        "The catalog UI did not render the required detail. No authentication failure was detected; preserve the journal and frozen ZIPs.");
}

function catalogUploadControl(page: Page): Locator {
  return page.getByRole("button", { name: "Upload file", exact: true, includeHidden: true });
}

export async function openCatalog(page: Page, artifact: Artifact): Promise<string> {
  let runtimeFailure = false;
  const onPageError = (error: Error) => {
    if (/\[MobX\] minified error nr: 35\b/.test(error.message)) runtimeFailure = true;
  };
  page.on("pageerror", onPageError);
  try {
    return await readCatalog(page, artifact, () => runtimeFailure, () => { runtimeFailure = false; });
  } finally {
    page.off("pageerror", onPageError);
  }
}

async function readCatalog(page: Page, artifact: Artifact, hasRuntimeFailure: () => boolean, resetRuntimeFailure: () => void): Promise<string> {
  for (let attempt = 0; attempt < 2; attempt++) {
    resetRuntimeFailure();
    await page.goto(`${adminUrl}/${artifact.catalogId}`, { waitUntil: "domcontentloaded", timeout: 45000 });
    const deadline = Date.now() + 60000;
    let state: ReturnType<typeof catalogState> = "loading";
    while (state === "loading" && Date.now() < deadline) {
      state = await readCatalogState(page, artifact.appId);
      if (state === "loading" && hasRuntimeFailure()) break;
      if (state === "loading") await page.waitForTimeout(250);
    }
    if ((state === "loading" || state === "chunk-failure") && attempt === 0) {
      const reason = state === "chunk-failure" ? "CDN chunk load failed" :
        hasRuntimeFailure() ? "app-detail rendering failed (MobX error 35)" : "app-detail shell stalled for 60 seconds";
      console.warn(`${artifact.name}: catalog ${reason}; retrying read-only navigation once. No upload is being retried.`);
      continue;
    }
    if (state === "loading") {
      throw new Error(`${artifact.name}: catalog detail did not become ready after one read-only reload; runtimeFailure=${hasRuntimeFailure() ? "MobX-35" : "not-detected"}; ${await catalogDiagnostic(page, artifact.appId)}`);
    }
    if (state !== "ready") throw new Error(`${artifact.name}: catalog ${state}; ${await catalogDiagnostic(page, artifact.appId)}`);
    if (new URL(page.url()).pathname !== `/policies/manage-apps/${artifact.catalogId}`) throw new Error("Catalog identity URL changed.");
    try {
      await page.getByRole("main").getByText(/\bEveryone\b/).first().waitFor({ state: "attached", timeout: 60000 });
    } catch (error) {
      throw new Error(`${artifact.name}: expected Everyone availability was not found. No permissions will be changed; ${await catalogDiagnostic(page, artifact.appId)}`, { cause: error });
    }
    return readVersion(await page.getByRole("main").innerText(), "catalog", artifact.appId);
  }
  throw new Error(`${artifact.name}: catalog read-only retry exhausted.`);
}

export async function uploadPortal(page: Page, artifact: Artifact): Promise<void> {
  await domClick(page.getByRole("button", { name: "Import app", exact: true }));
  await page.locator('input[type="file"]').setInputFiles({ name: "appPackage.dev.zip", mimeType: "application/zip", buffer: artifact.buffer });
  const dialog = page.getByRole("dialog").filter({ hasText: "No issues found" });
  await dialog.waitFor({ state: "attached", timeout: 60000 });
  await dialog.evaluate((element) => {
    const button = [...element.querySelectorAll("button")].find((candidate) => candidate.textContent?.trim() === "Upload");
    if (!button || button.disabled) throw new Error("Validated import has no enabled Upload button.");
    button.click();
  });
  await page.waitForURL(`**/apps/${artifact.appId}/dashboard`, { waitUntil: "domcontentloaded", timeout: 60000 });
}

export async function uploadCatalog(page: Page, artifact: Artifact): Promise<void> {
  try {
    await domClick(catalogUploadControl(page));
  } catch (error) {
    throw new Error(`${artifact.name}: catalog Upload file control unavailable; ${await catalogDiagnostic(page, artifact.appId)}`, { cause: error });
  }
  await page.locator('input[type="file"]').setInputFiles({ name: "appPackage.dev.zip", mimeType: "application/zip", buffer: artifact.buffer });
  await page.waitForFunction((version) => {
    const text = document.body.innerText;
    return /Updated[\s\S]*in your list/i.test(text) ||
      new RegExp(`Published version\\s+${version.replaceAll(".", "\\.")}\\b`, "i").test(text);
  }, artifact.version, { timeout: 60000 });
}

export async function verifyReadback(read: () => Promise<string>, version: string, delay: () => Promise<void>): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const current = await read();
    if (current === version) return;
    needsUpload(current, version);
    if (attempt < 2) await delay();
  }
  throw new Error(`Persisted readback did not reach ${version}. No upload will be retried; resume with the same ZIP and journal.`);
}

export async function publishStage(
  artifact: Artifact, stage: Stage, read: () => Promise<string>, upload: () => Promise<void>,
  persist: () => void, delay: () => Promise<void>
): Promise<void> {
  const current = await read();
  if (!needsUpload(current, artifact.version)) {
    stage.status = stage.status === "upload-started" || stage.status === "verified" ? "verified" : "already-current";
    stage.checkedAt = new Date().toISOString();
    persist();
    return;
  }
  assertUploadAllowed(stage);
  stage.status = "upload-started";
  persist();
  await upload();
  await verifyReadback(read, artifact.version, delay);
  stage.status = "verified";
  stage.checkedAt = new Date().toISOString();
  persist();
}

export function assertProfileOutsideRepository(profile: string, repository: string): void {
  // Resolve existing ancestors so junctions/symlinks cannot place browser credentials in the worktree.
  function canonical(path: string): string {
    if (existsSync(path)) return realpathSync(path);
    const parent = dirname(path);
    if (parent === path) return path;
    return join(canonical(parent), relative(parent, path));
  }
  const inside = relative(canonical(repository), canonical(profile));
  if (!inside || (!isAbsolute(inside) && inside !== ".." && !inside.startsWith(`..${sep}`))) {
    throw new Error("Browser profile must be outside the repository.");
  }
}

async function main(): Promise<void> {
  const { values } = parseArgs({ options: {
    execute: { type: "boolean" }, login: { type: "boolean" }, agents: { type: "string" },
    profile: { type: "string" }, report: { type: "string" }, help: { type: "boolean" }
  } });
  if (values.help) {
    console.log("pnpm publish:agents [--agents manager,auditor,editor,generator] [--login | --execute] [--profile <external-folder>] [--report <journal.json>]\nDefault: local artifact preflight only. Validate/package once before running. No backend deployment.");
    return;
  }
  if (values.execute && values.login) throw new Error("Use --login separately from --execute.");
  const selected = selectAgents(values.agents);
  const profile = resolve(values.profile ?? join(process.env.LOCALAPPDATA ?? homedir(), "PDS-Project-AI", "publication-edge-profile"));
  assertProfileOutsideRepository(profile, root);
  if (values.login) {
    const context = await chromium.launchPersistentContext(profile, { channel: "msedge", headless: false, viewport: { width: 1440, height: 1000 } });
    try {
      const portal = await context.newPage();
      const catalog = await context.newPage();
      await portal.goto(portalUrl, { waitUntil: "domcontentloaded" });
      await catalog.goto(adminUrl, { waitUntil: "domcontentloaded" });
      const input = createInterface({ input: process.stdin, output: process.stdout });
      try { await input.question("Complete sign-in and MFA in both tabs for the intended tenant, then press Enter to verify access. No uploads will run. "); }
      finally { input.close(); }
      const artifact = loadArtifact(selected[0]);
      await openPortal(portal, artifact);
      await openCatalog(catalog, artifact);
      console.log("Developer Portal and tenant catalog access verified. Edge will close; rerun --execute with the same profile and release journal.");
    } finally { await context.close(); }
    return;
  }
  const artifacts = selected.map(loadArtifact);
  console.table(artifacts.map(({ name, appId, version, sha256 }) => ({ name, appId, version, sha256 })));
  if (!values.execute) {
    console.log("Preflight only: ZIP identity/version/inlined instructions checked; no browser opened or uploads made. WIQD validation must be completed before --execute.");
    return;
  }
  const report = resolve(values.report ?? join(root, "tmp", "agent-publication.json"));
  const journal = reconcileJournal(existsSync(report) ? JSON.parse(readFileSync(report, "utf8")) : undefined, artifacts, {
    repository: sourceState(root), assets: sourceState(root)
  });
  const persist = () => saveJournal(report, journal);
  persist();
  const context = await chromium.launchPersistentContext(profile, { channel: "msedge", headless: false, viewport: { width: 1440, height: 1000 } });
  try {
    const portal = await context.newPage();
    const catalog = await context.newPage();
    const delay = () => new Promise<void>((done) => setTimeout(done, 10000));
    // Check every target on both surfaces before the first write.
    for (const artifact of artifacts) {
      const entry = journal.entries.find((candidate) => candidate.name === artifact.name)!;
      if (needsUpload(await openPortal(portal, artifact), artifact.version)) assertUploadAllowed(entry.portal);
      if (needsUpload(await openCatalog(catalog, artifact), artifact.version)) assertUploadAllowed(entry.catalog);
    }
    for (const artifact of artifacts) {
      const entry = journal.entries.find((candidate) => candidate.name === artifact.name)!;
      console.log(`${artifact.name}: synchronizing Developer Portal`);
      await publishStage(artifact, entry.portal, () => openPortal(portal, artifact), () => uploadPortal(portal, artifact), persist, delay);
      console.log(`${artifact.name}: synchronizing tenant catalog`);
      await publishStage(artifact, entry.catalog, () => openCatalog(catalog, artifact), () => uploadCatalog(catalog, artifact), persist, delay);
    }
    // Fresh persisted readback after all writes, not just an upload acknowledgement.
    for (const artifact of artifacts) {
      await verifyReadback(() => openPortal(portal, artifact), artifact.version, delay);
      await verifyReadback(() => openCatalog(catalog, artifact), artifact.version, delay);
    }
    console.log(`Portal/catalog versions, app identities, and Everyone availability verified. Journal: ${report}\nAlready-current versions are not proof of remote ZIP checksum or live Copilot behavior.`);
  } finally { await context.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error: unknown) => {
    console.error(`Agent publication failed: ${error instanceof Error ? error.message : String(error)}\nNo automatic upload retry. Check authentication, tenant permissions, UI changes, and the release journal before resuming.`);
    process.exitCode = 1;
  });
}
