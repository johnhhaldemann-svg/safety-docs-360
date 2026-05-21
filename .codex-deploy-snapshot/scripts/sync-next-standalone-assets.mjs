/**
 * Next `output: "standalone"` does not copy `.next/static` or `public` into the
 * standalone folder; the server process chdir's there and expects them under
 * `.next/standalone/.next/static` and `.next/standalone/public`.
 * Without this step, the packaged desktop app loads HTML but CSS/JS/images 404.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const standaloneNext = path.join(root, ".next", "standalone", ".next");
const srcStatic = path.join(root, ".next", "static");
const destStatic = path.join(standaloneNext, "static");
const srcPublic = path.join(root, "public");
const destPublic = path.join(root, ".next", "standalone", "public");

function syncDir(label, src, dest) {
  if (!fs.existsSync(src)) {
    console.error(`${label}: missing source:\n${src}\nRun: npm run desktop:build:web (without this script) or next build first.`);
    process.exit(1);
  }
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(src, dest, { recursive: true });
  console.log(`${label}: synced\n  ${src}\n  -> ${dest}`);
}

syncDir(".next/static", srcStatic, destStatic);
if (fs.existsSync(srcPublic)) {
  syncDir("public", srcPublic, destPublic);
} else {
  console.warn("public/: not found, skipping (optional).");
}
