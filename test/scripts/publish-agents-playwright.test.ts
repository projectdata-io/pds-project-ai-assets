import { describe, expect, it, vi } from "vitest";
import { strToU8, zipSync } from "fflate";
import { join } from "node:path";
import {
  agents, assertProfileOutsideRepository, catalogState, inspectArtifact, needsUpload, publishStage,
  readVersion, reconcileJournal, selectAgents, verifyReadback
} from "../../scripts/publish-agents-playwright.js";

function artifact(overrides = {}) {
  return inspectArtifact(agents[0], "package.zip", Buffer.from(zipSync({
    "manifest.json": strToU8(JSON.stringify({ id: agents[0].appId, version: "2.3.9", ...overrides })),
    "declarativeAgent.json": strToU8(JSON.stringify({ instructions: "Packaged agent instructions." }))
  })), "2.3.9");
}
const source = { repository: "root-sha", assets: "asset-sha + uncommitted changes" };

describe("agent publication preflight", () => {
  it("distinguishes catalog load, authentication, permission, and CDN failures", () => {
    const state = (text: string, origin = "https://admin.teams.microsoft.com") => catalogState({ origin, text, appId: agents[0].appId });
    expect(state("Loading")).toBe("loading");
    expect(state("Sign in to your account")).toBe("login");
    expect(state("Approve sign in")).toBe("login");
    expect(state("Request wasn't sent")).toBe("login");
    expect(state("Verify your identity")).toBe("login");
    expect(catalogState({ origin: "https://admin.teams.microsoft.com", text: "", title: "Sign in to your account", appId: agents[0].appId })).toBe("login");
    expect(catalogState({ origin: "https://admin.teams.microsoft.com", text: "Loading", authenticationFrame: true, appId: agents[0].appId })).toBe("login");
    expect(state("", "https://login.microsoftonline.com")).toBe("login");
    expect(state("You don't have permission")).toBe("denied");
    expect(state("Loading chunk 878 failed.")).toBe("chunk-failure");
    expect(state("ChunkLoadError")).toBe("chunk-failure");
    expect(state(`${agents[0].appId}\nPublished version\n2.3.9`)).toBe("ready");
  });
  it("defaults to exactly four active agents and supports an explicit subset", () => {
    expect(selectAgents(undefined)).toHaveLength(4);
    expect(selectAgents("auditor,generator").map((agent) => agent.name)).toEqual(["auditor", "generator"]);
    expect(() => selectAgents("resource-manager")).toThrow("inactive");
    expect(() => selectAgents("auditor,auditor")).toThrow("distinct");
  });
  it("checks ZIP identity, source version, and records a SHA-256", () => {
    expect(artifact().sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(() => artifact({ id: agents[1].appId })).toThrow("app ID");
    expect(() => artifact({ version: "2.3.8" })).toThrow("version");
  });
  it("rejects unbundled instructions and missing ZIP entries", () => {
    const zip = (instructions: string) => Buffer.from(zipSync({
      "manifest.json": strToU8(JSON.stringify({ id: agents[0].appId, version: "2.3.9" })),
      "declarativeAgent.json": strToU8(JSON.stringify({ instructions }))
    }));
    expect(() => inspectArtifact(agents[0], "a.zip", zip("${file(instruction.txt)}"), "2.3.9")).toThrow("inlined");
    expect(() => inspectArtifact(agents[0], "a.zip", Buffer.from(zipSync({})), "2.3.9")).toThrow("missing");
  });
  it("requires an external browser profile", () => {
    expect(() => assertProfileOutsideRepository(process.cwd(), process.cwd())).toThrow("outside");
    expect(() => assertProfileOutsideRepository(join(process.cwd(), "tmp", "browser"), process.cwd())).toThrow("outside");
  });
  it("reads versions only with the expected identity, refusing ambiguous output", () => {
    expect(readVersion(`${agents[0].appId}\nPublished version\n2.3.9\nEveryone`, "catalog", agents[0].appId)).toBe("2.3.9");
    expect(readVersion(`Manager ${agents[0].appId} 2.3.9`, "portal", agents[0].appId)).toBe("2.3.9");
    expect(() => readVersion("2.3.9", "portal", agents[0].appId)).toThrow("app ID");
    expect(() => readVersion(`${agents[0].appId} 2.3.8 2.3.9`, "portal", agents[0].appId)).toThrow("uniquely");
  });
  it("compares versions numerically and refuses downgrades", () => {
    expect(needsUpload("2.3.9", "2.3.10")).toBe(true);
    expect(needsUpload("2.3.9", "2.3.9")).toBe(false);
    expect(() => needsUpload("2.3.10", "2.3.9")).toThrow("downgrade");
  });
  it("resumes only identical artifacts and preserves uncertain stages", () => {
    const release = reconcileJournal(undefined, [artifact()], source);
    release.entries[0].portal.status = "upload-started";
    expect(reconcileJournal(release, [artifact()], source).entries[0].portal.status).toBe("upload-started");
    expect(() => reconcileJournal(release, [{ ...artifact(), sha256: "changed" }], source)).toThrow("artifacts differ");
    expect(() => reconcileJournal({}, [artifact()], source)).toThrow("Invalid");
  });
  it("preserves original provenance and refuses a different resume selection", () => {
    const release = reconcileJournal(undefined, [artifact()], source);
    expect(reconcileJournal(release, [artifact()], { repository: "later", assets: "later" }).source).toEqual(source);
    expect(() => reconcileJournal(release, [], source)).toThrow("same agent selection");
    release.entries[0].portal = { status: "pending" };
    const invalid = { ...release, entries: [{ ...release.entries[0], portal: { status: "success" } }] };
    expect(() => reconcileJournal(invalid, [artifact()], source)).toThrow("Invalid journal stage");
  });
});

describe("publication stage safety", () => {
  it("journals before upload, uploads once and retries stale readback only", async () => {
    const entry = reconcileJournal(undefined, [artifact()], source).entries[0];
    const read = vi.fn().mockResolvedValueOnce("2.3.8").mockResolvedValueOnce("2.3.8").mockResolvedValue("2.3.9");
    const persist = vi.fn();
    const upload = vi.fn(async () => {
      expect(entry.portal.status).toBe("upload-started");
      expect(persist).toHaveBeenCalledOnce();
    });
    const delay = vi.fn(async () => {});
    await publishStage(artifact(), entry.portal, read, upload, persist, delay);
    expect(upload).toHaveBeenCalledOnce();
    expect(delay).toHaveBeenCalledOnce();
    expect(entry.portal.status).toBe("verified");
  });
  it("skips an already-current version without claiming remote checksum verification", async () => {
    const entry = reconcileJournal(undefined, [artifact()], source).entries[0];
    const upload = vi.fn();
    await publishStage(artifact(), entry.portal, async () => "2.3.9", upload, vi.fn(), vi.fn());
    expect(upload).not.toHaveBeenCalled();
    expect(entry.portal.status).toBe("already-current");
  });
  it("keeps upload-started on failure and never repeats an uncertain write", async () => {
    const entry = reconcileJournal(undefined, [artifact()], source).entries[0];
    const upload = vi.fn(async () => { throw new Error("connection lost"); });
    await expect(publishStage(artifact(), entry.portal, async () => "2.3.8", upload, vi.fn(), vi.fn())).rejects.toThrow("connection lost");
    expect(entry.portal.status).toBe("upload-started");
    await expect(publishStage(artifact(), entry.portal, async () => "2.3.8", upload, vi.fn(), vi.fn())).rejects.toThrow("No automatic reupload");
    expect(upload).toHaveBeenCalledOnce();
  });
  it("can verify an uncertain write after restarting without repeating it", async () => {
    const entry = reconcileJournal(undefined, [artifact()], source).entries[0];
    entry.portal.status = "upload-started";
    const upload = vi.fn();
    await publishStage(artifact(), entry.portal, async () => "2.3.9", upload, vi.fn(), vi.fn());
    expect(entry.portal.status).toBe("verified");
    expect(upload).not.toHaveBeenCalled();
  });
  it("bounds stale reads and surfaces auth/UI failures immediately", async () => {
    const read = vi.fn(async () => "2.3.8");
    await expect(verifyReadback(read, "2.3.9", async () => {})).rejects.toThrow("Persisted readback");
    expect(read).toHaveBeenCalledTimes(3);
    const denied = vi.fn(async (): Promise<string> => { throw new Error("Access denied"); });
    await expect(verifyReadback(denied, "2.3.9", async () => {})).rejects.toThrow("Access denied");
    expect(denied).toHaveBeenCalledOnce();
  });
});
