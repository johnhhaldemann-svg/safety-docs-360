import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextResponse } from "next/server";
import { isOfflineDesktopEnabled } from "@/lib/offlineDesktopSession";

export const runtime = "nodejs";

const demoPackFiles = {
  csep: {
    fileName: "North_Tower_Issued_CSEP_Summit_Ridge.docx",
    contentType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  },
  pshsep: {
    fileName: "North_Tower_Issued_PSHSEP_Summit_Ridge.docx",
    contentType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  },
} as const;

type DemoPackFileId = keyof typeof demoPackFiles;

function resolveDemoPackDeliverablesCandidates() {
  const home = os.homedir();
  const userProfile = process.env.USERPROFILE?.trim() || home;
  const oneDrive = process.env.OneDrive?.trim() || "";
  const oneDriveConsumer = process.env.OneDriveConsumer?.trim() || "";

  const candidates = [
    path.join(/* turbopackIgnore: true */ oneDrive, "Desktop", "safepredict_offline_demo_pack", "deliverables"),
    path.join(/* turbopackIgnore: true */ oneDriveConsumer, "Desktop", "safepredict_offline_demo_pack", "deliverables"),
    path.join(/* turbopackIgnore: true */ userProfile, "OneDrive", "Desktop", "safepredict_offline_demo_pack", "deliverables"),
    path.join(/* turbopackIgnore: true */ userProfile, "Desktop", "safepredict_offline_demo_pack", "deliverables"),
    path.join(/* turbopackIgnore: true */ home, "Desktop", "safepredict_offline_demo_pack", "deliverables"),
  ].filter(Boolean);

  return Array.from(new Set(candidates));
}

function resolveDemoPackDeliverablesDir() {
  const candidates = resolveDemoPackDeliverablesCandidates();
  return candidates.find((candidate) => fs.existsSync(/* turbopackIgnore: true */ candidate)) ?? null;
}

function getDemoPackFileId(request: Request): DemoPackFileId | null {
  const rawFileId = new URL(request.url).searchParams.get("file") ?? "csep";
  return rawFileId in demoPackFiles ? (rawFileId as DemoPackFileId) : null;
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

export async function GET(request: Request) {
  if (!isOfflineDesktopEnabled()) {
    return NextResponse.json({ error: "Offline desktop mode is disabled." }, { status: 404 });
  }

  const fileId = getDemoPackFileId(request);
  if (!fileId) {
    return NextResponse.json({ error: "Unknown demo pack file." }, { status: 400 });
  }

  const deliverablesDir = resolveDemoPackDeliverablesDir();
  if (!deliverablesDir) {
    const candidates = resolveDemoPackDeliverablesCandidates();
    return NextResponse.json(
      {
        error:
          "Demo pack folder was not found. Run desktop:build:handoff first so safepredict_offline_demo_pack is created on Desktop.",
        candidates,
      },
      { status: 404 }
    );
  }

  const file = demoPackFiles[fileId];
  const filePath = path.join(/* turbopackIgnore: true */ deliverablesDir, file.fileName);

  if (!fs.existsSync(/* turbopackIgnore: true */ filePath)) {
    return NextResponse.json(
      {
        error: `Demo pack file was not found: ${file.fileName}`,
        candidates: [filePath],
      },
      { status: 404 }
    );
  }

  const buffer = fs.readFileSync(/* turbopackIgnore: true */ filePath);
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": file.contentType,
      "Content-Disposition": `attachment; filename="${file.fileName}"`,
      "Cache-Control": "no-store",
    },
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
          "Demo pack folder was not found. Run desktop:build:handoff first so safepredict_offline_demo_pack is created on Desktop.",
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

