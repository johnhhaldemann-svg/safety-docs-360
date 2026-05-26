/**
 * Local Vercel sanity checks for pilot deployments.
 *
 * This does not call Vercel APIs. It verifies the repo is pinned to Node 20 and
 * warns if the local linked project metadata still advertises a different
 * dashboard runtime.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const packageJsonPath = path.join(root, "package.json");
const vercelProjectPath = path.join(root, ".vercel", "project.json");

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

const pkg = readJson(packageJsonPath);
const nodeEngine = String(pkg.engines?.node ?? "").trim();

if (nodeEngine !== "20.x") {
  console.error(`package.json engines.node must be "20.x" for pilot deploys; found "${nodeEngine || "(missing)"}".`);
  process.exit(1);
}

console.log("package.json engines.node is pinned to 20.x.");

if (fs.existsSync(vercelProjectPath)) {
  const project = readJson(vercelProjectPath);
  const configuredNode = String(project.settings?.nodeVersion ?? "").trim();
  if (configuredNode && configuredNode !== "20.x") {
    console.warn(
      [
        `Local Vercel project metadata reports nodeVersion "${configuredNode}".`,
        "Vercel supports package.json engines overrides, but update Project Settings > Build and Deployment > Node.js Version to 20.x for clean evidence.",
      ].join("\n")
    );
  } else if (configuredNode) {
    console.log("Local Vercel project metadata is aligned to Node 20.x.");
  }
} else {
  console.warn("No .vercel/project.json found; run `vercel link` before production evidence capture.");
}
