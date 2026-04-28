import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { getJobsiteAccessScope, isJobsiteAllowed } from "@/lib/jobsiteAccess";
import { canManageObservations } from "@/lib/companyPermissions";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 120);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_submit_documents", "can_create_documents", "can_view_all_company_data"],
  });
  if ("error" in auth) return auth.error;
  if (!canManageObservations(auth.role)) {
    return NextResponse.json({ error: "You do not have permission to upload audit evidence." }, { status: 403 });
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
    .select("id, audit_id, jobsite_id")
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
    return NextResponse.json({ error: "You can only upload evidence for assigned jobsites." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { fileName?: string; mimeType?: string } | null;
  const rawName = String(body?.fileName ?? "").trim();
  if (!rawName) return NextResponse.json({ error: "fileName is required." }, { status: 400 });

  const adminClient = createSupabaseAdminClient();
  if (!adminClient) {
    return NextResponse.json({ error: "Missing Supabase service role env configuration." }, { status: 500 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const jobsiteSegment = observation.data.jobsite_id ?? "unassigned";
  const fileName = sanitizeFileName(rawName);
  const path = `companies/${companyScope.companyId}/jobsites/${jobsiteSegment}/field-audits/${today}/${observation.data.audit_id}/${id}/${Date.now()}-${fileName}`;
  const signedResult = await adminClient.storage.from("documents").createSignedUploadUrl(path);
  if (signedResult.error || !signedResult.data?.token) {
    return NextResponse.json({ error: signedResult.error?.message || "Failed to create signed upload URL." }, { status: 500 });
  }

  return NextResponse.json({
    bucket: "documents",
    path,
    token: signedResult.data.token,
    mimeType: body?.mimeType ?? null,
  });
}
