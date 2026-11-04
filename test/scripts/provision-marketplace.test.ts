import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  assertUniqueProductionIdentities,
  getProductionIdentityState,
  productionPackages,
  validateExecutionIntent,
  validateProductionLifecycle
} from "../../scripts/provision-marketplace.mjs";

const rootPath = fileURLToPath(new URL("../../", import.meta.url));
const manager = productionPackages[0];
const dev = { TEAMS_APP_ID: "dev-app", [manager.dcrEnvironmentVariable]: "dev-dcr" };

describe("production identity provisioning", () => {
  it("requires explicit production confirmation for execution", () => {
    expect(() => validateExecutionIntent({ execute: false, confirmProduction: false })).not.toThrow();
    expect(() => validateExecutionIntent({ execute: true, confirmProduction: false })).toThrow("dry-run by default");
    expect(() => validateExecutionIntent({ execute: true, confirmProduction: true })).not.toThrow();
  });

  it("recognizes fresh and complete production identities without reusing dev IDs", () => {
    expect(getProductionIdentityState(manager, {}, dev).status).toBe("pending");
    expect(getProductionIdentityState(manager, {
      TEAMS_APP_ID: "prod-app",
      [manager.dcrEnvironmentVariable]: "prod-dcr"
    }, dev).status).toBe("provisioned");
    expect(() => getProductionIdentityState(manager, {
      TEAMS_APP_ID: "dev-app",
      [manager.dcrEnvironmentVariable]: "prod-dcr"
    }, dev)).toThrow("must not reuse");
  });

  it("stops on partial identity output and duplicate IDs", () => {
    expect(() => getProductionIdentityState(manager, { TEAMS_APP_ID: "prod-app" }, dev)).toThrow("partial");
    expect(() => assertUniqueProductionIdentities([
      { slug: "manager", appId: "same-app", dcrId: "manager-dcr" },
      { slug: "auditor", appId: "same-app", dcrId: "auditor-dcr" }
    ])).toThrow("must be unique");
  });

  it("keeps production lifecycle identity-only and cross-tenant for all four agents", () => {
    for (const packageInfo of productionPackages) {
      const lifecycle = readFileSync(
        join(rootPath, "apps", packageInfo.slug, "production-provision", "m365agents.yml"),
        "utf8"
      );
      expect(() => validateProductionLifecycle(lifecycle, packageInfo)).not.toThrow();
    }
  });
});