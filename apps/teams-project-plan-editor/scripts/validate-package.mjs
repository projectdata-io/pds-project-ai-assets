import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

execFileSync(process.execPath, [fileURLToPath(new URL("../../../scripts/validate-teams-packages.mjs", import.meta.url))], { stdio: "inherit" });
