import { NextResponse } from "next/server";
import { authorizeRequest, isAdminRole } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type UploadUrlPayload = {
  fileName?: string;
  mimeType?: string;
};

function canManageReportFiles(role: string) {
  return (
    isAdminRole(role) ||
    role === "company_admin" ||
    role === "manager" ||
    role === "safety_manager" ||
    role === "project_manager"
  );
}

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 120);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_view_analytics", "can_view_all_company_data"],
  });
  if ("error" in auth) return auth.error;
  if (!canManageReportFiles(auth.role)) {
    return NextResponse.json({ error: "You do not have permission to upload report attachments." }, { status: 403 });
  }

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) {
    return NextResponse.json({ error: "No company scope found." }, { status: 400 });
  }

  const { id } = await params;
  const reportResult = await auth.supabase
    .from("company_reports")
    .select("id, jobsite_id")
    .eq("id", id)
    .eq("company_id", companyScope.companyId)
    .maybeSingle();
  if (reportResult.error) {
    return NextResponse.json({ error: reportResult.error.message || "Failed to load report." }, { status: 500 });
  }
  if (!reportResult.data) {
    return NextResponse.json({ error: "Report not found." }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as UploadUrlPayload | null;
  const rawName = String(body?.fileName ?? "").trim();
  if (!rawName) return NextResponse.json({ error: "fileName is required." }, { status: 400 });
  const fileName = sanitizeFileName(rawName);
  const jobsiteSegment = reportResult.data.jobsite_id ?? "unassigned";
  const path = `companies/${companyScope.companyId}/jobsites/${jobsiteSegment}/reports/${id}/${Date.now()}-${fileName}`;

  const adminClient = createSupabaseAdminClient();
  if (!adminClient) {
    return NextResponse.json({ error: "Missing Supabase service role env configuration." }, { status: 500 });
  }
  const signedResult = await adminClient.storage.from("documents").createSignedUploadUrl(path);
  if (signedResult.error || !signedResult.data?.token) {
    return NextResponse.json(
      { error: signedResult.error?.message || "Failed to create signed upload URL." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    bucket: "documents",
    path,
    token: signedResult.data.token,
    mimeType: body?.mimeType ?? null,
    reportId: id,
    jobsiteId: reportResult.data.jobsite_id,
  });
}
