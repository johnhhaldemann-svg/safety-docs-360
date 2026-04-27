import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextResponse } from "next/server";
import { isOfflineDesktopEnabled } from "@/lib/offlineDesktopSession";

export const runtime = "nodejs";

function resolveDemoPackDeliverablesCandidates() {
  const home = os.homedir();
  const userProfile = process.env.USERPROFILE?.trim() || home;
  const oneDrive = process.env.OneDrive?.trim() || "";
  const oneDriveConsumer = process.env.OneDriveConsumer?.trim() || "";

  const candidates = [
    path.join(oneDrive, "Desktop", "safety360_offline_demo_pack", "deliverables"),
    path.join(oneDriveConsumer, "Desktop", "safety360_offline_demo_pack", "deliverables"),
    path.join(userProfile, "OneDrive", "Desktop", "safety360_offline_demo_pack", "deliverables"),
    path.join(userProfile, "Desktop", "safety360_offline_demo_pack", "deliverables"),
    path.join(home, "Desktop", "safety360_offline_demo_pack", "deliverables"),
  ].filter(Boolean);

  return Array.from(new Set(candidates));
}

function resolveDemoPackDeliverablesDir() {
  const candidates = resolveDemoPackDeliverablesCandidates();
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}

function openFolderWindows(dir: string) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn("explorer.exe", [dir], {
      detached: true,
      stdio: "ignore",
    });
    child.on("error", reject);
    child.unref();
    resolve();
  });
}

export async function POST() {
  if (!isOfflineDesktopEnabled()) {
    return NextResponse.json({ error: "Offline desktop mode is disabled." }, { status: 404 });
  }

  const deliverablesDir = resolveDemoPackDeliverablesDir();
  if (!deliverablesDir) {
    const candidates = resolveDemoPackDeliverablesCandidates();
    return NextResponse.json(
      {
        error:
          "Demo pack folder was not found. Run desktop:build:handoff first so safety360_offline_demo_pack is created on Desktop.",
        candidates,
      },
      { status: 404 }
    );
  }

  try {
    await openFolderWindows(deliverablesDir);
    return NextResponse.json({
      success: true,
      path: deliverablesDir,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not open the demo pack folder.",
      },
      { status: 500 }
    );
  }
}

