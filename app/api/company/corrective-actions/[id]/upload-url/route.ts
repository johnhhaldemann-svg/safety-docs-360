import { NextResponse } from "next/server";
import { authorizeRequest, isAdminRole } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { blockIfCsepOnlyCompany } from "@/lib/csepApiGuard";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type UploadUrlPayload = {
  fileName?: string;
  mimeType?: string;
};

function canUploadEvidence(role: string) {
  return (
    isAdminRole(role) ||
    role === "company_admin" ||
    role === "manager" ||
    role === "safety_manager" ||
    role === "project_manager" ||
    role === "field_supervisor" ||
    role === "foreman"
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
    requireAnyPermission: ["can_edit_documents", "can_view_all_company_data"],
  });
  if ("error" in auth) return auth.error;
  if (!canUploadEvidence(auth.role)) {
    return NextResponse.json({ error: "You do not have permission to upload evidence." }, { status: 403 });
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
  const csepBlock = await blockIfCsepOnlyCompany(auth.supabase, companyScope.companyId);
  if (csepBlock) return csepBlock;

  const { id } = await params;
  const actionResult = await auth.supabase
    .from("company_corrective_actions")
    .select("id, jobsite_id")
    .eq("id", id)
    .eq("company_id", companyScope.companyId)
    .maybeSingle();
  if (actionResult.error) {
    return NextResponse.json({ error: actionResult.error.message || "Failed to load observation." }, { status: 500 });
  }
  if (!actionResult.data) {
    return NextResponse.json({ error: "Observation not found." }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as UploadUrlPayload | null;
  const rawName = String(body?.fileName ?? "").trim();
  if (!rawName) return NextResponse.json({ error: "fileName is required." }, { status: 400 });
  const fileName = sanitizeFileName(rawName);
  const today = new Date().toISOString().slice(0, 10);
  const jobsiteSegment = actionResult.data.jobsite_id ?? "unassigned";
  const path = `companies/${companyScope.companyId}/jobsites/${jobsiteSegment}/observations/${today}/${id}/${Date.now()}-${fileName}`;

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
  });
}
