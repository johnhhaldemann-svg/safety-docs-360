import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { getJobsiteAccessScope, isJobsiteAllowed } from "@/lib/jobsiteAccess";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { isMultipartPhotoRequest, sanitizeMobileFileName, uploadMobilePhotoFromRequest } from "@/lib/mobilePhotoUpload";

export const runtime = "nodejs";

function sanitizeFileName(name: string) {
  return sanitizeMobileFileName(name);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_submit_documents", "can_create_documents", "can_view_all_company_data"],
  });
  if ("error" in auth) return auth.error;
  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) return NextResponse.json({ error: "No company scope found." }, { status: 400 });
  const { id } = await params;
  const audit = await auth.supabase
    .from("company_jobsite_audits")
    .select("id, jobsite_id")
    .eq("id", id)
    .eq("company_id", companyScope.companyId)
    .maybeSingle();
  if (audit.error) return NextResponse.json({ error: audit.error.message || "Failed to load audit." }, { status: 500 });
  if (!audit.data) return NextResponse.json({ error: "Audit not found." }, { status: 404 });
  const jobsiteScope = await getJobsiteAccessScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    companyId: companyScope.companyId,
    role: auth.role,
  });
  if (!isJobsiteAllowed(audit.data.jobsite_id ?? null, jobsiteScope)) {
    return NextResponse.json({ error: "Audit access denied for this jobsite." }, { status: 403 });
  }

  if (isMultipartPhotoRequest(request)) {
    try {
      const photo = await uploadMobilePhotoFromRequest(
        request,
        `companies/${companyScope.companyId}/field-audits/${id}`
      );
      const insert = await auth.supabase
        .from("company_jobsite_audit_evidence")
        .insert({
          company_id: companyScope.companyId,
          audit_id: id,
          jobsite_id: audit.data.jobsite_id ?? null,
          file_path: photo.filePath,
          file_name: photo.fileName,
          mime_type: photo.mimeType,
          created_by: auth.user.id,
        })
        .select("*")
        .single();
      if (insert.error) {
        return NextResponse.json({ error: insert.error.message || "Failed to attach audit photo." }, { status: 500 });
      }
      return NextResponse.json({ success: true, photo: insert.data });
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Photo upload failed." }, { status: 400 });
    }
  }

  const body = (await request.json().catch(() => null)) as { fileName?: string; mimeType?: string; filePath?: string } | null;
  const filePath = String(body?.filePath ?? "").trim();
  const fileName = String(body?.fileName ?? "").trim() || filePath.split("/").pop() || "";
  if (filePath) {
    const insert = await auth.supabase
      .from("company_jobsite_audit_evidence")
      .insert({
        company_id: companyScope.companyId,
        audit_id: id,
        jobsite_id: audit.data.jobsite_id ?? null,
        file_path: filePath,
        file_name: fileName,
        mime_type: String(body?.mimeType ?? "").trim() || null,
        created_by: auth.user.id,
      })
      .select("*")
      .single();
    if (insert.error) return NextResponse.json({ error: insert.error.message || "Failed to attach audit photo." }, { status: 500 });
    return NextResponse.json({ success: true, photo: insert.data });
  }

  const safeFileName = sanitizeFileName(fileName);
  if (!safeFileName) return NextResponse.json({ error: "fileName is required." }, { status: 400 });
  const adminClient = createSupabaseAdminClient();
  if (!adminClient) return NextResponse.json({ error: "Missing storage configuration." }, { status: 500 });
  const path = `companies/${companyScope.companyId}/field-audits/${id}/${Date.now()}-${safeFileName}`;
  const signed = await adminClient.storage.from("documents").createSignedUploadUrl(path);
  if (signed.error || !signed.data?.token) {
    return NextResponse.json({ error: signed.error?.message || "Failed to create upload URL." }, { status: 500 });
  }
  return NextResponse.json({ bucket: "documents", path, token: signed.data.token, mimeType: body?.mimeType ?? null });
}
