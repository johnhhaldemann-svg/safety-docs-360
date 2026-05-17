import { NextResponse } from "next/server";
import { authorizeRequest, isAdminRole } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { recordCompanySecurityEvent } from "@/lib/companySecurityEvents";
import { blockIfCsepOnlyCompany } from "@/lib/csepApiGuard";
import { getClientIpAddress } from "@/lib/legal";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { OFFLINE_DEMO_EMAIL } from "@/lib/offlineDesktopSession";

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
    role === "foreman" ||
    role === "sales_demo"
  );
}

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 120);
}

function isDemoRequest(auth: { role: string; user: { email?: string | null } }) {
  return (
    auth.role === "sales_demo" ||
    (auth.user.email ?? "").trim().toLowerCase() === OFFLINE_DEMO_EMAIL.toLowerCase()
  );
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

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as UploadUrlPayload | null;
  const rawName = String(body?.fileName ?? "").trim();
  if (!rawName) return NextResponse.json({ error: "fileName is required." }, { status: 400 });
  const fileName = sanitizeFileName(rawName);
  if (isDemoRequest(auth)) {
    const today = new Date().toISOString().slice(0, 10);
    return NextResponse.json({
      bucket: "documents",
      path: `demo/offline/proof/${today}/${id}/${Date.now()}-${fileName}`,
      token: "offline-demo-token",
      mimeType: body?.mimeType ?? null,
    });
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

  await recordCompanySecurityEvent({
    supabase: adminClient,
    companyId: companyScope.companyId,
    jobsiteId: actionResult.data.jobsite_id ?? null,
    actorUserId: auth.user.id,
    actorRole: auth.role,
    eventType: "file_upload_link_created",
    resourceType: "storage_object",
    resourceId: path,
    title: "Corrective action evidence upload link created",
    detail: "A signed upload token was created for corrective action evidence.",
    ipAddress: getClientIpAddress(request),
    userAgent: request.headers.get("user-agent"),
    metadata: {
      bucket: "documents",
      path,
      correctiveActionId: id,
      mimeType: body?.mimeType ?? null,
    },
  });

  return NextResponse.json({
    bucket: "documents",
    path,
    token: signedResult.data.token,
    mimeType: body?.mimeType ?? null,
  });
}
