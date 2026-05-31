import { NextResponse } from "next/server";
import { createApprovedSource, defaultTrustLevelForSource, isAllowedSourceType, isAllowedTrustLevel } from "@/lib/gusLearning";
import { assertAiKnowledgeWritesEnabled } from "@/lib/aiKnowledgeMap/guardrails";
import { uploadDocumentsBucketObject } from "@/lib/supabaseStorageServer";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { authorizeSuperadminAiEngineRequest } from "@/lib/superadmin/aiEngineAuth";
import { aiKnowledgeMapActionError } from "../route-helpers";

export const runtime = "nodejs";
const MAX_TRUSTED_DOCUMENT_BYTES = 25 * 1024 * 1024;
const TRUSTED_DOCUMENT_TYPES = new Map([
  [".pdf", new Set(["application/pdf"])],
  [".doc", new Set(["application/msword", "application/octet-stream"])],
  [".docx", new Set(["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/octet-stream"])],
  [".txt", new Set(["text/plain", "application/octet-stream"])],
  [".md", new Set(["text/markdown", "text/plain", "application/octet-stream"])],
]);

function text(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function companyScope(value: unknown) {
  const id = text(value);
  return id && id !== "all" && id !== "global" ? id : null;
}

function safeFileName(value: string) {
  return (value || "document").replace(/[^a-zA-Z0-9._-]/g, "_");
}

function fileExtension(fileName: string) {
  const match = fileName.toLowerCase().match(/\.[a-z0-9]+$/);
  return match?.[0] ?? "";
}

function validateTrustedDocumentFile(file: File) {
  if (file.size > MAX_TRUSTED_DOCUMENT_BYTES) return "Trusted learning documents must be 25 MB or smaller.";
  const ext = fileExtension(file.name);
  const allowedTypes = TRUSTED_DOCUMENT_TYPES.get(ext);
  if (!allowedTypes) return "Trusted learning documents must be PDF, Word, TXT, or Markdown files.";
  const mime = file.type || "application/octet-stream";
  if (!allowedTypes.has(mime)) return "Trusted learning document MIME type does not match the allowed file extension.";
  return null;
}

async function logTrustedInputEvent(admin: ReturnType<typeof createSupabaseAdminClient>, input: { companyId: string | null; eventType: string; description: string; metadata: Record<string, unknown>; createdBy: string }) {
  if (!admin) return;
  await admin.from("ai_engine_events").insert({
    company_id: input.companyId,
    event_type: input.eventType,
    description: input.description,
    message: input.description,
    metadata: input.metadata,
    created_by: input.createdBy,
    created_by_type: "user",
  });
}

async function listTrustedInputs(request: Request) {
  const auth = await authorizeSuperadminAiEngineRequest(request);
  if ("error" in auth) return auth.error;

  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "Service role client is required for trusted AI learning inputs." }, { status: 500 });

  const { searchParams } = new URL(request.url);
  const selectedCompanyId = companyScope(searchParams.get("companyId"));
  const sourceQuery = admin
    .from("approved_sources")
    .select("id, company_id, source_name, source_url, domain, source_type, jurisdiction, trust_level, is_active, created_at, updated_at")
    .order("updated_at", { ascending: false })
    .limit(20);
  const scopedSourceQuery = selectedCompanyId ? sourceQuery.or(`company_id.is.null,company_id.eq.${selectedCompanyId}`) : sourceQuery.is("company_id", null);
  const documentQuery = admin
    .from("documents")
    .select("id, company_id, document_title, document_type, category, status, final_file_path, file_name, updated_at, created_at")
    .not("final_file_path", "is", null)
    .eq("status", "approved")
    .order("updated_at", { ascending: false })
    .limit(20);
  const scopedDocumentQuery = selectedCompanyId ? documentQuery.or(`company_id.is.null,company_id.eq.${selectedCompanyId}`) : documentQuery.is("company_id", null);
  const [sources, documents] = await Promise.all([scopedSourceQuery, scopedDocumentQuery]);

  if (sources.error) return NextResponse.json({ error: sources.error.message }, { status: 500 });
  if (documents.error) return NextResponse.json({ error: documents.error.message }, { status: 500 });
  return NextResponse.json({ sources: sources.data ?? [], documents: documents.data ?? [] });
}

async function addTrustedSource(request: Request) {
  const auth = await authorizeSuperadminAiEngineRequest(request);
  if ("error" in auth) return auth.error;
  try {
    assertAiKnowledgeWritesEnabled("Trusted AI learning source creation");

    const admin = createSupabaseAdminClient();
    if (!admin) return NextResponse.json({ error: "Service role client is required for trusted AI learning sources." }, { status: 500 });

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const sourceType = body?.sourceType ?? body?.source_type;
    if (!isAllowedSourceType(sourceType)) return NextResponse.json({ error: "A valid source type is required." }, { status: 400 });
    const trustLevelRaw = body?.trustLevel ?? body?.trust_level;
    const trustLevel = isAllowedTrustLevel(trustLevelRaw)
      ? trustLevelRaw
      : defaultTrustLevelForSource(sourceType, text(body?.domain));
    const result = await createApprovedSource(admin, {
      companyId: companyScope(body?.companyId),
      sourceName: text(body?.sourceName ?? body?.source_name),
      sourceUrl: text(body?.sourceUrl ?? body?.source_url),
      domain: text(body?.domain) || null,
      sourceType,
      jurisdiction: text(body?.jurisdiction, "Federal"),
      trustLevel,
      isActive: body?.isActive !== false && body?.is_active !== false,
      createdBy: auth.user.id,
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    await logTrustedInputEvent(admin, {
      companyId: result.source.company_id ?? null,
      eventType: "trusted_source_created",
      description: "Super Admin created a trusted AI learning source.",
      metadata: { sourceId: result.source.id, sourceUrl: result.source.source_url, domain: result.source.domain, trustLevel: result.source.trust_level },
      createdBy: auth.user.id,
    }).catch(() => undefined);
    return NextResponse.json({ source: result.source }, { status: 201 });
  } catch (error) {
    return aiKnowledgeMapActionError(error, "Failed to add trusted learning source.");
  }
}

async function addTrustedDocument(request: Request) {
  const auth = await authorizeSuperadminAiEngineRequest(request);
  if ("error" in auth) return auth.error;
  try {
    assertAiKnowledgeWritesEnabled("Trusted AI learning document upload");

    const admin = createSupabaseAdminClient();
    if (!admin) return NextResponse.json({ error: "Service role client is required for trusted AI learning documents." }, { status: 500 });

    const formData = await request.formData().catch(() => null);
    if (!formData) return NextResponse.json({ error: "Expected multipart form data." }, { status: 400 });
    const file = formData.get("file");
    if (!(file instanceof File) || file.size <= 0) return NextResponse.json({ error: "A document file is required." }, { status: 400 });
    const fileError = validateTrustedDocumentFile(file);
    if (fileError) return NextResponse.json({ error: fileError }, { status: 400 });

    const companyId = companyScope(formData.get("companyId"));
    const title = text(formData.get("title"));
    if (!title) return NextResponse.json({ error: "Document title is required." }, { status: 400 });

    const documentId = crypto.randomUUID();
    const fileName = safeFileName(file.name);
    const storagePrefix = companyId ? `companies/${companyId}/ai-knowledge-library` : "ai-knowledge-library/global";
    const storagePath = `${storagePrefix}/${documentId}/${fileName}`;
    const uploaded = await uploadDocumentsBucketObject(
      storagePath,
      Buffer.from(await file.arrayBuffer()),
      file.type || "application/octet-stream",
      { upsert: true },
    );
    if (!uploaded.ok) return NextResponse.json({ error: uploaded.error }, { status: uploaded.status });

    const now = new Date().toISOString();
    const { data, error } = await admin
      .from("documents")
      .insert({
        id: documentId,
        company_id: companyId,
        user_id: auth.user.id,
        document_title: title,
        project_name: title,
        document_type: text(formData.get("documentType"), "AI Knowledge Library"),
        category: text(formData.get("category"), "Knowledge Library"),
        status: "approved",
        notes: "AI Knowledge Library trusted learning document. Human Review: approved by Super Admin upload.",
        file_name: fileName,
        file_size: file.size,
        final_file_path: uploaded.key,
        uploaded_by: auth.user.email ?? "Super Admin",
        approved_at: now,
        approved_by: auth.user.id,
        approved_by_email: auth.user.email ?? null,
      })
      .select("id")
      .single();
    if (error || !data) return NextResponse.json({ error: error?.message ?? "Failed to create trusted learning document." }, { status: 500 });
    await logTrustedInputEvent(admin, {
      companyId,
      eventType: "trusted_document_uploaded",
      description: "Super Admin uploaded a trusted AI learning document.",
      metadata: {
        documentId: data.id,
        fileName,
        fileSize: file.size,
        mimeType: file.type || "application/octet-stream",
        malwareScanStatus: "not_available",
      },
      createdBy: auth.user.id,
    }).catch(() => undefined);
    return NextResponse.json({ documentId: data.id }, { status: 201 });
  } catch (error) {
    return aiKnowledgeMapActionError(error, "Failed to upload trusted learning document.");
  }
}

export async function GET(request: Request) {
  return listTrustedInputs(request);
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) return addTrustedDocument(request);
  return addTrustedSource(request);
}
