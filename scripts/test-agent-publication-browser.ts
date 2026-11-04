import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:net";
import { chromium } from "playwright";
import { strToU8, zipSync } from "fflate";
import { agents, inspectArtifact, openCatalog, openCatalogWithSignInRecovery, openPortal, openPortalWithSignInRecovery, publishStage, reconcileJournal, uploadCatalog, uploadPortal } from "./publish-agents-playwright.js";

const agent = agents[0];
const artifact = inspectArtifact(agent, "fixture.zip", Buffer.from(zipSync({
  "manifest.json": strToU8(JSON.stringify({ id: agent.appId, version: "2.3.9" })),
  "declarativeAgent.json": strToU8(JSON.stringify({ instructions: "Synthetic fixture instructions." }))
})), "2.3.9");
const journal = reconcileJournal(undefined, [artifact], { repository: "synthetic", assets: "synthetic" });
const portProbe = createServer();
await new Promise<void>((done) => portProbe.listen(0, "127.0.0.1", done));
const address = portProbe.address();
assert(address && typeof address !== "string");
await new Promise<void>((done, reject) => portProbe.close((error) => error ? reject(error) : done()));
const browser = await chromium.launch({ channel: "msedge", chromiumSandbox: true, headless: true,
  args: [`--remote-debugging-port=${address.port}`, "--remote-debugging-address=127.0.0.1"] });
try {
  const context = await browser.newContext();
  let portalVersion = "2.3.8";
  let portalRequiresSignIn = false;
  let portalAutomaticSignIn = false;
  let portalNavigations = 0;
  let catalogVersion = "2.3.8";
  let catalogMode: "normal" | "no-upload" | "chunk-once" | "chunk-always" | "shell-recovers" | "shell-once" | "shell-twice" | "shell-always" | "login" | "mfa" | "auth-frame" | "mfa-recovers" | "auth-frame-recovers" | "denied" = "normal";
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
      if (portalRequiresSignIn) {
        portalNavigations++;
        if (portalAutomaticSignIn) {
          const ready = JSON.stringify(`<div role="grid"><div role="row">${agent.appId} ${portalVersion}</div></div>`);
          await route.fulfill({ contentType: "text/html", body: `<title>Sign in to your account</title><main>Approve sign in</main><script>setTimeout(() => { document.title = "Apps"; document.body.innerHTML = ${ready}; }, 300);</script>` });
          return;
        }
        await route.fulfill({ contentType: "text/html", body: '<title>Sign in to your account</title><main>Approve sign in</main>' });
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
      if (catalogMode === "mfa-recovers" || catalogMode === "auth-frame-recovers") {
        const content = JSON.stringify(`${agent.appId}<p>Published version</p><p>${catalogVersion}</p><p>Everyone</p>`);
        const auth = catalogMode === "mfa-recovers" ? '<title>Sign in to your account</title><main>Approve sign in</main>' : '<main>Loading</main><iframe src="https://login.microsoftonline.com/fixture"></iframe>';
        await route.fulfill({ contentType: "text/html", body: `${auth}<script>setTimeout(() => { document.querySelector("iframe")?.remove(); document.title = "Manage app"; document.querySelector("main").innerHTML = ${content}; }, 800);</script>` });
        return;
      }
      if (catalogMode === "shell-recovers") {
        const content = JSON.stringify(`${agent.appId}<p>Published version</p><p>${catalogVersion}</p><p>Everyone</p>`);
        await route.fulfill({ contentType: "text/html", body: `<main></main><script>setTimeout(() => { document.querySelector("main").innerHTML = ${content}; }, 300);</script><script>throw new Error("[MobX] minified error nr: 35. Synthetic fixture");</script>` });
        return;
      }
      if (catalogMode === "shell-always" || (catalogMode === "shell-once" && catalogNavigations === 1) || (catalogMode === "shell-twice" && catalogNavigations <= 2)) {
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
  const recoveryPage = await context.newPage();
  portalRequiresSignIn = true;
  let signInPrompts = 0;
  assert.equal(await openPortalWithSignInRecovery(recoveryPage, artifact, async () => {
    signInPrompts++;
    portalRequiresSignIn = false;
    await recoveryPage.goto("https://dev.teams.microsoft.com/apps");
  }), artifact.version);
  assert.equal(signInPrompts, 1, "A portal OAuth redirect prompts once and retries in the same context");
  portalRequiresSignIn = true;
  portalAutomaticSignIn = true;
  const beforeAutomaticSignIn = portalNavigations;
  assert.equal(await openPortalWithSignInRecovery(recoveryPage, artifact), artifact.version);
  assert.equal(portalNavigations, beforeAutomaticSignIn + 1, "Completed MFA resumes without another navigation or Enter prompt");
  portalRequiresSignIn = false;
  portalAutomaticSignIn = false;
  assert.equal(uploaded.length, 2, "Portal sign-in recovery must not upload during preflight");
  await recoveryPage.close();
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
  catalogMode = "shell-recovers";
  catalogNavigations = 0;
  assert.equal(await openCatalog(catalog, artifact), artifact.version);
  assert.equal(catalogNavigations, 1, "A MobX error does not force reload if the detail becomes ready");
  catalogMode = "shell-once";
  catalogNavigations = 0;
  assert.equal(await openCatalog(catalog, artifact), artifact.version);
  assert.equal(catalogNavigations, 2, "MobX shell failure permits one read-only reload");
  catalogMode = "shell-twice";
  catalogNavigations = 0;
  assert.equal(await openCatalog(catalog, artifact), artifact.version);
  assert.equal(catalogNavigations, 3, "A second MobX shell failure permits one more read-only reload");
  catalogMode = "shell-always";
  catalogNavigations = 0;
  await assert.rejects(openCatalog(catalog, artifact), /after 2 read-only reloads; runtimeFailure=MobX-35/);
  assert.equal(catalogNavigations, 3, "Persistent shell failure stops after two read-only reloads");
  catalogMode = "login";
  await assert.rejects(openCatalog(catalog, artifact), /catalog login;.*current tab/);
  catalogMode = "denied";
  await assert.rejects(openCatalog(catalog, artifact), /catalog denied/);
  catalogMode = "mfa";
  await assert.rejects(openCatalog(catalog, artifact), /catalog login;.*current tab/);
  catalogMode = "auth-frame";
  await assert.rejects(openCatalog(catalog, artifact), /catalog login;.*current tab/);
  for (const mode of ["mfa-recovers", "auth-frame-recovers"] as const) {
    catalogMode = mode;
    catalogNavigations = 0;
    assert.equal(await openCatalogWithSignInRecovery(catalog, artifact), artifact.version);
    assert.equal(catalogNavigations, 1, "Catalog MFA resumes in the same tab without restarting authentication");
  }
  assert.equal(uploaded.length, 2, "Error handling must never trigger another upload");
  const attached = await chromium.connectOverCDP(`http://127.0.0.1:${address.port}`);
  await attached.close();
  assert(browser.isConnected(), "Disconnecting the publisher must not close the shared browser");
  assert.equal(await portal.title(), "", "Existing browser tabs survive publisher disconnection");
  console.log("Edge fixture passed: identical ZIP uploads, hidden upload controls, control-independent readback, bounded CDN recovery, explicit login/permission errors, and no duplicate uploads. No network publication.");
} finally {
  await browser.close();
}
