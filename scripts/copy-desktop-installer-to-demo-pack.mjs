/**
 * After `npm run desktop:build`, copies the NSIS installer into the sibling
 * safety360_offline_demo_pack folder so it is easy to find on USB / Desktop.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { DESKTOP_ELECTRON_OUT_DIR } from "./desktop-electron-out-dir.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const distElectronOut = path.join(root, DESKTOP_ELECTRON_OUT_DIR);
const demoPack = path.join(root, "..", "safety360_offline_demo_pack");
const outDir = path.join(demoPack, "installer");

function main() {
  if (!fs.existsSync(distElectronOut)) {
    console.error(`Missing ${DESKTOP_ELECTRON_OUT_DIR}/. Run: npm run desktop:build`);
    process.exit(1);
  }
  if (!fs.existsSync(demoPack)) {
    console.error(`Demo pack folder not found:\n${demoPack}\nExpected safety360_offline_demo_pack next to safety_docs_360.`);
    process.exit(1);
  }

  const exes = fs
    .readdirSync(distElectronOut)
    .filter((name) => name.toLowerCase().endsWith(".exe") && name.toLowerCase().includes("setup"))
    .map((name) => ({ name, mtime: fs.statSync(path.join(distElectronOut, name)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);

  if (exes.length === 0) {
    console.error(`No Setup *.exe found in ${DESKTOP_ELECTRON_OUT_DIR}/. Run: npm run desktop:build`);
    process.exit(1);
  }

  const newest = exes[0].name;
  const src = path.join(distElectronOut, newest);
  fs.mkdirSync(outDir, { recursive: true });
  const dest = path.join(outDir, newest);
  fs.copyFileSync(src, dest);

  const note = [
    "SafetyDocs360 Offline Demo — Windows installer",
    "",
    `Copied from: ${src}`,
    `You can run this file to install (or reinstall) the demo.`,
    "",
    "After install, if the app does not open:",
    `  1. Open File Explorer and paste this in the address bar:`,
    `     %APPDATA%\\SafetyDocs360 Offline Demo`,
    `  2. Open READ_ME_FIRST.txt and next-server.log`,
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
  ].join("\n");

  fs.writeFileSync(path.join(outDir, "INSTALLER_LOCATION.txt"), note, "utf8");
  console.log(`Copied installer to:\n${dest}\n\n${note}`);
}

main();
