import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { chromium } from "playwright";
import { strToU8, zipSync } from "fflate";
import { agents, inspectArtifact, openCatalog, openPortal, publishStage, reconcileJournal, uploadCatalog, uploadPortal } from "./publish-agents-playwright.js";

const agent = agents[0];
const artifact = inspectArtifact(agent, "fixture.zip", Buffer.from(zipSync({
  "manifest.json": strToU8(JSON.stringify({ id: agent.appId, version: "2.3.9" })),
  "declarativeAgent.json": strToU8(JSON.stringify({ instructions: "Synthetic fixture instructions." }))
})), "2.3.9");
const journal = reconcileJournal(undefined, [artifact], { repository: "synthetic", assets: "synthetic" });
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  const context = await browser.newContext();
  let portalVersion = "2.3.8";
  let catalogVersion = "2.3.8";
  let catalogMode: "normal" | "no-upload" | "chunk-once" | "chunk-always" | "shell-once" | "shell-always" | "login" | "mfa" | "auth-frame" | "denied" = "normal";
  let catalogNavigations = 0;
  const uploaded: { surface: string; sha256: string }[] = [];
  await context.exposeBinding("recordUpload", (_source, surface: string, bytes: number[]) => {
    uploaded.push({ surface, sha256: createHash("sha256").update(Buffer.from(bytes)).digest("hex") });
    if (surface === "portal") portalVersion = artifact.version;
    else catalogVersion = artifact.version;
  });
  // All requests are intercepted: this test never contacts Microsoft or publishes an app.
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    const fileInput = `<input type="file" hidden>`;
    if (url.hostname === "dev.teams.microsoft.com") {
      if (url.pathname !== "/apps") {
        await route.fulfill({ contentType: "text/html", body: "<main>Dashboard</main>" });
        return;
      }
      await route.fulfill({ contentType: "text/html", body: `
        <div role="grid"><div role="row">${agent.appId} ${portalVersion}</div></div>
        <button onclick="document.querySelector('input').hidden=false">Import app</button>
        ${fileInput}
        <div role="dialog" style="height:0;overflow:hidden">No issues found
          <button onclick="publish()">Upload</button>
        </div>
        <script>
          async function publish() {
            const file = document.querySelector('input').files[0];
            await window.recordUpload('portal', [...new Uint8Array(await file.arrayBuffer())]);
            location.href = '/apps/${agent.appId}/dashboard';
          }
        </script>` });
      return;
    }
    if (url.hostname === "admin.teams.microsoft.com") {
      catalogNavigations++;
      if (catalogMode === "shell-always" || (catalogMode === "shell-once" && catalogNavigations === 1)) {
        await route.fulfill({ contentType: "text/html", body: '<title>Manage app - Microsoft Teams admin center</title><main></main><script>throw new Error("[MobX] minified error nr: 35. Synthetic fixture");</script>' });
        return;
      }
      if (catalogMode === "auth-frame") {
        await route.fulfill({ contentType: "text/html", body: '<main>Loading</main><iframe src="https://login.microsoftonline.com/fixture"></iframe>' });
        return;
      }
      if (catalogMode === "mfa") {
        await route.fulfill({ contentType: "text/html", body: '<title>Sign in to your account</title><main>Approve sign in</main>' });
        return;
      }
      if (catalogMode === "chunk-always" || (catalogMode === "chunk-once" && catalogNavigations === 1)) {
        await route.fulfill({ contentType: "text/html", body: "<main>Loading chunk 878 failed.</main>" });
        return;
      }
      if (catalogMode === "login" || catalogMode === "denied") {
        await route.fulfill({ contentType: "text/html", body: `<main>${catalogMode === "login" ? "Sign in to your account" : "You don't have permission"}</main>` });
        return;
      }
      await route.fulfill({ contentType: "text/html", body: `
        <main>${agent.appId}<p>Published version</p><p>${catalogVersion}</p><p>Everyone</p>
          ${catalogMode === "no-upload" ? "" : '<button aria-hidden="true" onclick="document.querySelector(\'input\').hidden=false">Upload file</button>'}
          ${fileInput}
        </main>
        <script>
          document.querySelector('input').onchange = async () => {
            const file = document.querySelector('input').files[0];
            await window.recordUpload('catalog', [...new Uint8Array(await file.arrayBuffer())]);
            document.querySelector('main').insertAdjacentHTML('beforeend', '<p>Updated Manager in your list</p>');
          };
        </script>` });
      return;
    }
    if (url.hostname === "login.microsoftonline.com") {
      await route.fulfill({ contentType: "text/html", body: "<main>Approve sign in</main>" });
      return;
    }
    await route.abort("blockedbyclient");
  });
  const portal = await context.newPage();
  const catalog = await context.newPage();
  const persist = () => {};
  const delay = async () => {};
  await publishStage(artifact, journal.entries[0].portal, () => openPortal(portal, artifact), () => uploadPortal(portal, artifact), persist, delay);
  await publishStage(artifact, journal.entries[0].catalog, () => openCatalog(catalog, artifact), () => uploadCatalog(catalog, artifact), persist, delay);
  assert.deepEqual(uploaded, [
    { surface: "portal", sha256: artifact.sha256 }, { surface: "catalog", sha256: artifact.sha256 }
  ]);
  assert.equal(journal.entries[0].portal.status, "verified");
  assert.equal(journal.entries[0].catalog.status, "verified");
  await publishStage(artifact, journal.entries[0].portal, () => openPortal(portal, artifact), () => uploadPortal(portal, artifact), persist, delay);
  await publishStage(artifact, journal.entries[0].catalog, () => openCatalog(catalog, artifact), () => uploadCatalog(catalog, artifact), persist, delay);
  assert.equal(uploaded.length, 2, "Rerun must not upload matching versions");
  catalogMode = "no-upload";
  assert.equal(await openCatalog(catalog, artifact), artifact.version, "Readback must not depend on the upload control");
  catalogMode = "chunk-once";
  catalogNavigations = 0;
  assert.equal(await openCatalog(catalog, artifact), artifact.version);
  assert.equal(catalogNavigations, 2, "Transient CDN failure permits one read-only reload");
  catalogMode = "chunk-always";
  catalogNavigations = 0;
  await assert.rejects(openCatalog(catalog, artifact), /catalog chunk-failure/);
  assert.equal(catalogNavigations, 2, "Persistent CDN failure stops after one retry");
  catalogMode = "shell-once";
  catalogNavigations = 0;
  assert.equal(await openCatalog(catalog, artifact), artifact.version);
  assert.equal(catalogNavigations, 2, "MobX shell failure permits one read-only reload");
  catalogMode = "shell-always";
  catalogNavigations = 0;
  await assert.rejects(openCatalog(catalog, artifact), /after one read-only reload; runtimeFailure=MobX-35/);
  assert.equal(catalogNavigations, 2, "Persistent shell failure must stop");
  catalogMode = "login";
  await assert.rejects(openCatalog(catalog, artifact), /catalog login;.*Use --login/);
  catalogMode = "denied";
  await assert.rejects(openCatalog(catalog, artifact), /catalog denied/);
  catalogMode = "mfa";
  await assert.rejects(openCatalog(catalog, artifact), /catalog login;.*Use --login/);
  catalogMode = "auth-frame";
  await assert.rejects(openCatalog(catalog, artifact), /catalog login;.*Use --login/);
  assert.equal(uploaded.length, 2, "Error handling must never trigger another upload");
  console.log("Edge fixture passed: identical ZIP uploads, hidden upload controls, control-independent readback, bounded CDN recovery, explicit login/permission errors, and no duplicate uploads. No network publication.");
} finally {
  await browser.close();
}
