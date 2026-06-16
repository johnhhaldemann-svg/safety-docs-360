import { NextResponse } from "next/server";
import { authorizeRequest, isCompanyRole } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { canMutateCompanyMemory } from "@/lib/companyMemoryAccess";
import { insertCompanyMemoryItem } from "@/lib/companyMemory";
import { extractGcProgramDocumentText } from "@/lib/gcProgramAiReview";
import { checkFixedWindowRateLimit } from "@/lib/rateLimit";
import { serverLog } from "@/lib/serverLog";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

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

  const adminClient = createSupabaseAdminClient();
  if (!adminClient) {
    await auth.supabase.storage.from("documents").remove([storagePath]).catch(() => undefined);
    return NextResponse.json({ error: "Gateway service unavailable." }, { status: 500 });
  }

  const candidateId = crypto.randomUUID();
  const { error: candidateError } = await adminClient
    .from("ai_knowledge_ingest_candidates")
    .insert({
      id: candidateId,
      company_id: companyScope.companyId,
      candidate_type: "node",
      source_table: "company_memory_items",
      source_id: candidateId,
      source_record_id: candidateId,
      title: title.slice(0, 500),
      semantic_summary: `Company memory item "${title.slice(0, 120)}" extracted from uploaded document, pending gateway review.`,
      reason: "Company memory bank upload queued for Super Admin gateway review before insertion.",
      source_evidence: [
        {
          sourceTable: "company_memory_items",
          sourceRecordId: candidateId,
          label: "Memory bank document",
          detail: `Document "${originalName}" uploaded by ${auth.user.id}. Extracted ${bodyText.length} characters. Storage: ${storagePath}`,
        },
      ],
      proposed_payload: {
        sourceTable: "company_memory_items",
        sourceId: candidateId,
        sourceRecordId: candidateId,
        companyId: companyScope.companyId,
        title: title.slice(0, 500),
        nodeType: "document",
        type: "document",
        category: "company memory",
        description: bodyText.slice(0, 500),
        semanticSummary: bodyText.slice(0, 500),
        riskLevel: "unknown",
        riskScore: null,
        trade: null,
        project: null,
        sourceUrl: null,
        sourceDocument: storagePath,
        metadata: {},
        vectorStatus: "pending",
        vectorCoordinates: { x: 0, y: 0, z: 0, cluster: "memory" },
        confidenceScore: null,
        validationStatus: "pending_review",
        createdByType: "user",
      },
      confidence_score: null,
      validation_status: "pending_review",
      metadata: {
        evidenceText: `Company memory document "${title.slice(0, 120)}" pending gateway review.`,
        requiresHumanReview: true,
        trustedMemoryWrite: false,
        doesNotProveCompliance: true,
        gatewaySubmission: true,
        targetTable: "company_memory_items",
        proposedRow: {
          company_id: companyScope.companyId,
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
          user_id: auth.user.id,
        },
        submittedBy: auth.user.id,
        storagePath,
        originalFileName: originalName,
        extractionTruncated: extracted.truncated,
        extractionMethod: extracted.method,
      },
      created_by_type: "user",
    });

  if (candidateError) {
    await auth.supabase.storage.from("documents").remove([storagePath]).catch(() => undefined);
    return NextResponse.json({ error: "Failed to queue memory item for gateway review." }, { status: 500 });
  }

  serverLog("info", "company_memory_upload_gateway", {
    companyId: companyScope.companyId,
    userId: auth.user.id,
    candidateId,
  });

  return NextResponse.json({
    id: candidateId,
    pendingGateway: true,
    extraction: { truncated: extracted.truncated, method: extracted.method },
  });
}
