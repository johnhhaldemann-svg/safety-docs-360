import { NextResponse } from "next/server";
import { authorizeRequest, isCompanyRole } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { canMutateCompanyMemory } from "@/lib/companyMemoryAccess";
import { insertCompanyMemoryItem } from "@/lib/companyMemory";
import { extractGcProgramDocumentText } from "@/lib/gcProgramAiReview";
import { checkFixedWindowRateLimit } from "@/lib/rateLimit";
import { serverLog } from "@/lib/serverLog";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_BYTES = 12 * 1024 * 1024;

export async function POST(request: Request) {
  const auth = await authorizeRequest(request);
  if ("error" in auth) {
    return auth.error;
  }

  if (!canMutateCompanyMemory(auth.role)) {
    return NextResponse.json(
      { error: "Only company leads can add memory bank entries." },
      { status: 403 }
    );
  }

  const rl = checkFixedWindowRateLimit(`company-memory-upload:${auth.user.id}`, {
    windowMs: 60_000,
    max: 15,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Too many uploads. Retry in ${rl.retryAfterSec}s.` },
      { status: 429 }
    );
  }

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });

  if (isCompanyRole(auth.role) && !companyScope.companyId) {
    return NextResponse.json(
      { error: "This account is not linked to a company workspace yet." },
      { status: 400 }
    );
  }

  if (!companyScope.companyId) {
    return NextResponse.json({ error: "No company workspace is linked to this account." }, { status: 400 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data." }, { status: 400 });
  }

  const file = formData.get("file");
  const titleField = formData.get("title");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required." }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (max 12 MB)." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const originalName = file.name?.trim() || "upload.pdf";

  const extracted = await extractGcProgramDocumentText(buffer, originalName);
  if (!extracted.ok) {
    return NextResponse.json({ error: extracted.error }, { status: 400 });
  }

  const bodyText = extracted.text.trim();
  if (!bodyText) {
    return NextResponse.json(
      { error: "No extractable text from this file. Try PDF or DOCX with selectable text." },
      { status: 400 }
    );
  }

  const title =
    typeof titleField === "string" && titleField.trim()
      ? titleField.trim()
      : originalName.replace(/\.[^/.]+$/, "").trim() || "Uploaded document";

  const safeSegment = originalName.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120) || "file";
  const storagePath = `companies/${companyScope.companyId}/memory-bank/files/${Date.now()}-${safeSegment}`;

  const { error: upErr } = await auth.supabase.storage.from("documents").upload(storagePath, buffer, {
    contentType: file.type?.trim() || "application/octet-stream",
    upsert: false,
  });

  if (upErr) {
    serverLog("warn", "company_memory_upload_storage_failed", {
      companyId: companyScope.companyId,
      message: upErr.message.slice(0, 200),
    });
    return NextResponse.json({ error: `Storage upload failed: ${upErr.message}` }, { status: 500 });
  }

  const { id, error: insErr } = await insertCompanyMemoryItem(auth.supabase, {
    companyId: companyScope.companyId,
    source: "document_upload",
    title: title.slice(0, 500),
    body: bodyText,
    metadata: {
      storagePath,
      originalFileName: originalName,
      mimeType: file.type || null,
      extractionTruncated: extracted.truncated,
      extractionMethod: extracted.method,
    },
    userId: auth.user.id,
    embed: true,
  });

  if (insErr || !id) {
    await auth.supabase.storage.from("documents").remove([storagePath]).catch(() => undefined);
    return NextResponse.json({ error: insErr ?? "Failed to save memory item." }, { status: 500 });
  }

  serverLog("info", "company_memory_upload", {
    companyId: companyScope.companyId,
    userId: auth.user.id,
    memoryItemId: id,
  });

  return NextResponse.json({
    id,
    extraction: { truncated: extracted.truncated, method: extracted.method },
  });
}
