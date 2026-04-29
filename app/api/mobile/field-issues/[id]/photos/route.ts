import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { getJobsiteAccessScope, isJobsiteAllowed } from "@/lib/jobsiteAccess";
import { forwardMobileJsonRequest } from "@/lib/mobileRouteForward";
import { isMultipartPhotoRequest, uploadMobilePhotoFromRequest } from "@/lib/mobilePhotoUpload";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (isMultipartPhotoRequest(request)) {
    const auth = await authorizeRequest(request, {
      requireAnyPermission: ["can_create_documents", "can_edit_documents", "can_view_all_company_data"],
    });
    if ("error" in auth) return auth.error;
    const companyScope = await getCompanyScope({
      supabase: auth.supabase,
      userId: auth.user.id,
      fallbackTeam: auth.team,
      authUser: auth.user,
    });
    if (!companyScope.companyId) return NextResponse.json({ error: "No company scope found." }, { status: 400 });
    const issue = await auth.supabase
      .from("company_corrective_actions")
      .select("id, jobsite_id")
      .eq("id", id)
      .eq("company_id", companyScope.companyId)
      .maybeSingle();
    if (issue.error) {
      return NextResponse.json({ error: issue.error.message || "Failed to load field issue." }, { status: 500 });
    }
    if (!issue.data) return NextResponse.json({ error: "Field issue not found." }, { status: 404 });
    const jobsiteScope = await getJobsiteAccessScope({
      supabase: auth.supabase,
      userId: auth.user.id,
      companyId: companyScope.companyId,
      role: auth.role,
    });
    if (!isJobsiteAllowed(issue.data.jobsite_id ?? null, jobsiteScope)) {
      return NextResponse.json({ error: "Field issue access denied for this jobsite." }, { status: 403 });
    }

    try {
      const photo = await uploadMobilePhotoFromRequest(
        request,
        `companies/${companyScope.companyId}/field-issues/${id}`
      );
      const insert = await auth.supabase
        .from("company_corrective_action_evidence")
        .insert({
          action_id: id,
          company_id: companyScope.companyId,
          file_path: photo.filePath,
          file_name: photo.fileName,
          mime_type: photo.mimeType,
          created_by: auth.user.id,
        })
        .select("id, action_id, company_id, file_path, file_name, mime_type, created_at")
        .single();
      if (insert.error) {
        return NextResponse.json({ error: insert.error.message || "Failed to attach field issue photo." }, { status: 500 });
      }
      return NextResponse.json({ success: true, evidence: insert.data });
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Photo upload failed." }, { status: 400 });
    }
  }

  const body = (await request.clone().json().catch(() => null)) as { filePath?: string } | null;
  const target = body?.filePath
    ? `/api/company/observations/${id}/evidence`
    : `/api/company/observations/${id}/upload-url`;
  return forwardMobileJsonRequest(request, target, { method: "POST" });
}
