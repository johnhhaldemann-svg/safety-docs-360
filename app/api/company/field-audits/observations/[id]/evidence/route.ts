import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { getJobsiteAccessScope, isJobsiteAllowed } from "@/lib/jobsiteAccess";
import { canManageObservations } from "@/lib/companyPermissions";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_submit_documents", "can_create_documents", "can_view_all_company_data"],
  });
  if ("error" in auth) return auth.error;
  if (!canManageObservations(auth.role)) {
    return NextResponse.json({ error: "You do not have permission to attach audit evidence." }, { status: 403 });
  }
  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) return NextResponse.json({ error: "No company scope found." }, { status: 400 });

  const { id } = await params;
  const observation = await auth.supabase
    .from("company_jobsite_audit_observations")
    .select("id, audit_id, jobsite_id, photo_count")
    .eq("id", id)
    .eq("company_id", companyScope.companyId)
    .maybeSingle();
  if (observation.error) {
    return NextResponse.json({ error: observation.error.message || "Failed to load audit observation." }, { status: 500 });
  }
  if (!observation.data) return NextResponse.json({ error: "Audit observation not found." }, { status: 404 });

  const jobsiteScope = await getJobsiteAccessScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    companyId: companyScope.companyId,
    role: auth.role,
  });
  if (!isJobsiteAllowed(observation.data.jobsite_id ?? null, jobsiteScope)) {
    return NextResponse.json({ error: "You can only attach evidence for assigned jobsites." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    filePath?: string;
    fileName?: string;
    mimeType?: string;
  } | null;
  const filePath = String(body?.filePath ?? "").trim();
  const fileName = String(body?.fileName ?? "").trim();
  const mimeType = String(body?.mimeType ?? "").trim() || null;
  if (!filePath || !fileName) {
    return NextResponse.json({ error: "filePath and fileName are required." }, { status: 400 });
  }

  const insert = await auth.supabase
    .from("company_jobsite_audit_observation_evidence")
    .insert({
      company_id: companyScope.companyId,
      audit_id: observation.data.audit_id,
      observation_id: id,
      jobsite_id: observation.data.jobsite_id ?? null,
      file_path: filePath,
      file_name: fileName,
      mime_type: mimeType,
      created_by: auth.user.id,
    })
    .select("*")
    .single();

  if (insert.error) {
    return NextResponse.json({ error: insert.error.message || "Failed to attach audit evidence." }, { status: 500 });
  }

  await auth.supabase
    .from("company_jobsite_audit_observations")
    .update({ photo_count: Number(observation.data.photo_count ?? 0) + 1 })
    .eq("id", id)
    .eq("company_id", companyScope.companyId);

  return NextResponse.json({ success: true, evidence: insert.data });
}
