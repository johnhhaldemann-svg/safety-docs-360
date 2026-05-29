import { NextResponse } from "next/server";
import { createApprovedSource, defaultTrustLevelForSource, isAllowedSourceType, isAllowedTrustLevel } from "@/lib/gusLearning";
import { uploadDocumentsBucketObject } from "@/lib/supabaseStorageServer";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { authorizeSuperadminAiEngineRequest } from "@/lib/superadmin/aiEngineAuth";

export const runtime = "nodejs";

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
  return NextResponse.json({ source: result.source }, { status: 201 });
}

async function addTrustedDocument(request: Request) {
  const auth = await authorizeSuperadminAiEngineRequest(request);
  if ("error" in auth) return auth.error;

  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "Service role client is required for trusted AI learning documents." }, { status: 500 });

  const formData = await request.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: "Expected multipart form data." }, { status: 400 });
  const file = formData.get("file");
  if (!(file instanceof File) || file.size <= 0) return NextResponse.json({ error: "A document file is required." }, { status: 400 });

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
  return NextResponse.json({ documentId: data.id }, { status: 201 });
}

export async function GET(request: Request) {
  return listTrustedInputs(request);
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) return addTrustedDocument(request);
  return addTrustedSource(request);
}
