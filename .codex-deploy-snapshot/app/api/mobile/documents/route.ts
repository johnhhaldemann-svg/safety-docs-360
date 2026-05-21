import { NextResponse } from "next/server";
import { getCompanyScope, uuidMatches } from "@/lib/companyScope";
import { isApprovedDocumentStatus, isArchivedDocumentStatus } from "@/lib/documentStatus";
import { requireMobileFeature } from "@/lib/mobileFeatureGate";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { authorizeRequest, isCompanyWorkspaceOversightRole } from "@/lib/rbac";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: [
      "can_create_documents",
      "can_submit_documents",
      "can_view_all_company_data",
      "can_view_dashboards",
    ],
  });
  if ("error" in auth) return auth.error;

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) return NextResponse.json({ documents: [] });
  const featureBlock = await requireMobileFeature({
    auth,
    companyId: companyScope.companyId,
    feature: "mobile_documents",
  });
  if (featureBlock) return featureBlock;

  const result = await auth.supabase
    .from("documents")
    .select("id, company_id, jobsite_id, title, document_title, document_type, status, final_file_path, approved_at, updated_at, created_at")
    .eq("company_id", companyScope.companyId)
    .order("updated_at", { ascending: false })
    .limit(100);

  if (result.error) {
    return NextResponse.json({ error: result.error.message || "Failed to load documents." }, { status: 500 });
  }

  const documents = ((result.data ?? []) as Array<Record<string, unknown>>).filter((document) => {
    const status = typeof document.status === "string" ? document.status : null;
    const finalFilePath = typeof document.final_file_path === "string" ? document.final_file_path : null;
    const companyId = typeof document.company_id === "string" ? document.company_id : null;
    if (!uuidMatches(companyId, companyScope.companyId)) return false;
    if (isArchivedDocumentStatus(status)) return false;
    return isCompanyWorkspaceOversightRole(auth.role) || isApprovedDocumentStatus(status, Boolean(finalFilePath));
  });

  return NextResponse.json({ documents });
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: [
      "can_create_documents",
      "can_submit_documents",
      "can_view_all_company_data",
      "can_view_dashboards",
    ],
  });
  if ("error" in auth) return auth.error;

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) {
    return NextResponse.json({ error: "This account is not linked to a company workspace yet." }, { status: 400 });
  }
  const featureBlock = await requireMobileFeature({
    auth,
    companyId: companyScope.companyId,
    feature: "mobile_documents",
  });
  if (featureBlock) return featureBlock;

  const body = (await request.json().catch(() => null)) as { documentId?: string } | null;
  const documentId = String(body?.documentId ?? "").trim();
  if (!documentId) return NextResponse.json({ error: "documentId is required." }, { status: 400 });

  const documentResult = await auth.supabase
    .from("documents")
    .select("id, company_id, title, document_title, status, final_file_path")
    .eq("id", documentId)
    .eq("company_id", companyScope.companyId)
    .maybeSingle();
  if (documentResult.error) {
    return NextResponse.json({ error: documentResult.error.message || "Failed to load document." }, { status: 500 });
  }
  if (!documentResult.data) return NextResponse.json({ error: "Document not found." }, { status: 404 });

  const finalFilePath = String(documentResult.data.final_file_path ?? "").trim();
  if (!isApprovedDocumentStatus(documentResult.data.status, Boolean(finalFilePath)) || !finalFilePath) {
    return NextResponse.json({ error: "Only approved final documents can be opened in the field app." }, { status: 403 });
  }

  const storageClient = createSupabaseAdminClient() ?? auth.supabase;
  const signed = await storageClient.storage.from("documents").createSignedUrl(finalFilePath, 120);
  if (signed.error || !signed.data?.signedUrl) {
    return NextResponse.json({ error: signed.error?.message || "Failed to create document link." }, { status: 500 });
  }

  return NextResponse.json({
    signedUrl: signed.data.signedUrl,
    expiresInSeconds: 120,
    document: documentResult.data,
  });
}
