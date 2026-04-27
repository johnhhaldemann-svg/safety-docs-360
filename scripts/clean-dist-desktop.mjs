/**
 * Clears the electron-builder output folder before repackaging.
 *
 * Builds now use `dist-electron-out/` (see package.json + desktop-electron-out-dir.mjs)
 * instead of `dist-desktop/`, so a Windows/OneDrive-locked legacy tree does not block CI.
 *
 * We still try to remove an old `dist-desktop/` best-effort only — never fail the build on it.
 *
 * Set SKIP_DESKTOP_KILL=1 to skip process termination.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { DESKTOP_ELECTRON_OUT_DIR } from "./desktop-electron-out-dir.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const distOut = path.join(root, DESKTOP_ELECTRON_OUT_DIR);
const legacyDistDesktop = path.join(root, "dist-desktop");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function toPsEncodedCommand(script) {
  return Buffer.from(script, "utf16le").toString("base64");
}

function tryStopProcessesHoldingPaths(paths) {
  if (process.env.SKIP_DESKTOP_KILL === "1" || process.platform !== "win32") return;

  const demo = "SafetyDocs360 Offline Demo.exe";
  spawnSync("taskkill", ["/F", "/IM", demo, "/T"], { stdio: "ignore", windowsHide: true });

  const roots = paths.map((p) => p.replace(/'/g, "''"));
  const conditions = roots
    .map(
      (r) =>
        `$_.ExecutablePath.StartsWith('${r}', [System.StringComparison]::OrdinalIgnoreCase)`
    )
    .join(" -or ");
  const ps = `
Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
  $_.ExecutablePath -and (${conditions})
} | ForEach-Object {
  Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
}
`.trim();

  spawnSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-EncodedCommand", toPsEncodedCommand(ps)], {
    stdio: "ignore",
    windowsHide: true,
  });

  spawnSync("taskkill", ["/F", "/IM", "app-builder.exe", "/T"], { stdio: "ignore", windowsHide: true });
}

function tryCmdRd(dir) {
  if (process.platform !== "win32" || !fs.existsSync(dir)) return false;
  const r = spawnSync("cmd.exe", ["/c", "rd", "/s", "/q", dir], {
    encoding: "utf8",
    windowsHide: true,
  });
  return r.status === 0 && !fs.existsSync(dir);
}

async function rmWithRetries(dir, attempts = 12, delayMs = 1000) {
  for (let i = 0; i < attempts; i++) {
    try {
      if (!fs.existsSync(dir)) return true;
      if (tryCmdRd(dir)) return true;
      fs.rmSync(dir, { recursive: true, force: true });
      if (!fs.existsSync(dir)) return true;
    } catch {
      // locked — retry
    }
    await sleep(delayMs);
  }
  return !fs.existsSync(dir);
}

function tryOrphanRename(dir) {
  if (!fs.existsSync(dir)) return true;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dest = `${dir}.orphan-${stamp}`;
  try {
    fs.renameSync(dir, dest);
    console.warn(
      `clean-dist-desktop: renamed locked folder (safe to delete later):\n  ${dest}`
    );
    return true;
  } catch {
    return false;
  }
}

async function removePrimaryOutputOrThrow() {
  const cleared = await rmWithRetries(distOut);
  if (cleared) return;
  if (tryOrphanRename(distOut)) return;
  throw new Error(
    [
      `Could not remove or rename electron output folder:\n${distOut}`,
      "",
      "Close the offline demo, pause OneDrive, then retry — or reboot and delete that folder.",
    ].join("\n")
  );
}

async function removeLegacyBestEffort() {
  if (!fs.existsSync(legacyDistDesktop)) return;
  const ok = await rmWithRetries(legacyDistDesktop, 4, 500);
  if (ok) {
    console.log(`clean-dist-desktop: removed legacy ${legacyDistDesktop}`);
    return;
  }
  if (tryOrphanRename(legacyDistDesktop)) return;
  console.warn(
    [
      `clean-dist-desktop: legacy folder is locked (build will still use ${DESKTOP_ELECTRON_OUT_DIR}/):`,
      legacyDistDesktop,
      "Delete or rename it manually when Windows/OneDrive releases the lock.",
    ].join("\n")
  );
}

async function main() {
  tryStopProcessesHoldingPaths([distOut, legacyDistDesktop]);
  await sleep(900);

  await removePrimaryOutputOrThrow();
  await removeLegacyBestEffort();

  console.log(`clean-dist-desktop: ready (output → ${DESKTOP_ELECTRON_OUT_DIR}/).`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
