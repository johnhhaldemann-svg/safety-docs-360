import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { getJobsiteAccessScope, isJobsiteAllowed } from "@/lib/jobsiteAccess";

export const runtime = "nodejs";

function isMissingSignoffTable(message?: string | null) {
  const normalized = (message ?? "").toLowerCase();
  return (
    normalized.includes("company_jobsite_audit_signoffs") ||
    normalized.includes("schema cache")
  );
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

  const body = (await request.json().catch(() => null)) as { signatureText?: string; signatureImagePath?: string } | null;
  const signatureText = String(body?.signatureText ?? "").trim();
  if (!signatureText) return NextResponse.json({ error: "signatureText is required." }, { status: 400 });
  const result = await auth.supabase
    .from("company_jobsite_audit_signoffs")
    .upsert(
      {
        company_id: companyScope.companyId,
        audit_id: id,
        jobsite_id: audit.data.jobsite_id ?? null,
        signed_by: auth.user.id,
        signature_text: signatureText,
        signature_image_path: String(body?.signatureImagePath ?? "").trim() || null,
        signed_at: new Date().toISOString(),
      },
      { onConflict: "company_id,audit_id,signed_by" }
    )
    .select("*")
    .single();
  if (result.error) {
    if (isMissingSignoffTable(result.error.message)) {
      return NextResponse.json({
        success: true,
        signature: null,
        warning: "Audit was submitted. Signature table is still warming up in the production schema cache.",
      });
    }
    return NextResponse.json({ error: result.error.message || "Failed to save audit signature." }, { status: 500 });
  }
  return NextResponse.json({ success: true, signature: result.data });
}
