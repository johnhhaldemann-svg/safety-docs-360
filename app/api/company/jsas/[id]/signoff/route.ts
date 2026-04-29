import { NextResponse } from "next/server";
import { authorizeRequest, normalizeAppRole } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { canManageCompanyJsa } from "@/lib/companyFeatureAccess";
import { getJobsiteAccessScope, isJobsiteAllowed } from "@/lib/jobsiteAccess";
import { blockIfCsepOnlyCompany } from "@/lib/csepApiGuard";

export const runtime = "nodejs";

function canSignJsa(role: string, permissionMap: Parameters<typeof canManageCompanyJsa>[1]) {
  const normalized = normalizeAppRole(role);
  return (
    canManageCompanyJsa(role, permissionMap) ||
    normalized === "field_user" ||
    normalized === "company_user"
  );
}

function cleanText(value: unknown, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_view_dashboards", "can_create_documents", "can_submit_documents", "can_view_all_company_data"],
  });
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) return NextResponse.json({ signoffs: [] });

  const result = await auth.supabase
    .from("company_jsa_signoffs")
    .select("*")
    .eq("company_id", companyScope.companyId)
    .eq("jsa_id", id)
    .order("signed_at", { ascending: false });

  if (result.error) {
    return NextResponse.json({ signoffs: [], warning: result.error.message }, { status: 200 });
  }
  return NextResponse.json({ signoffs: result.data ?? [] });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_create_documents", "can_submit_documents", "can_view_all_company_data"],
  });
  if ("error" in auth) return auth.error;
  if (!canSignJsa(auth.role, auth.permissionMap)) {
    return NextResponse.json({ error: "You do not have permission to sign this JSA." }, { status: 403 });
  }

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) {
    return NextResponse.json({ error: "This account is not linked to a company workspace yet." }, { status: 400 });
  }
  const csepBlock = await blockIfCsepOnlyCompany(auth.supabase, companyScope.companyId);
  if (csepBlock) return csepBlock;

  const { id } = await params;
  const existing = await auth.supabase
    .from("company_jsas")
    .select("id, jobsite_id")
    .eq("id", id)
    .eq("company_id", companyScope.companyId)
    .maybeSingle();
  if (existing.error) {
    return NextResponse.json({ error: existing.error.message || "Failed to load JSA." }, { status: 500 });
  }
  if (!existing.data) {
    return NextResponse.json({ error: "JSA not found." }, { status: 404 });
  }

  const jobsiteScope = await getJobsiteAccessScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    companyId: companyScope.companyId,
    role: auth.role,
  });
  if (!isJobsiteAllowed(existing.data.jobsite_id ?? null, jobsiteScope)) {
    return NextResponse.json({ error: "You can only sign JSAs for assigned jobsites." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const signatureText = cleanText(body?.signatureText ?? body?.signature);
  if (!signatureText) {
    return NextResponse.json({ error: "signatureText is required." }, { status: 400 });
  }

  const result = await auth.supabase
    .from("company_jsa_signoffs")
    .upsert(
      {
        company_id: companyScope.companyId,
        jsa_id: id,
        jobsite_id: existing.data.jobsite_id ?? null,
        signed_by: auth.user.id,
        crew_acknowledged: Boolean(body?.crewAcknowledged),
        supervisor_reviewed: Boolean(body?.supervisorReviewed),
        signature_text: signatureText,
        signature_image_path: cleanText(body?.signatureImagePath, 1000) || null,
        signed_at: new Date().toISOString(),
      },
      { onConflict: "company_id,jsa_id,signed_by" }
    )
    .select("*")
    .single();

  if (result.error) {
    return NextResponse.json({ error: result.error.message || "Failed to save JSA sign-off." }, { status: 500 });
  }

  return NextResponse.json({ success: true, signoff: result.data });
}
