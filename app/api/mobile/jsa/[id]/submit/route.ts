import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { getJobsiteAccessScope, isJobsiteAllowed } from "@/lib/jobsiteAccess";
import { blockIfCsepOnlyCompany } from "@/lib/csepApiGuard";

export const runtime = "nodejs";

function isPendingReviewConstraintError(message?: string | null) {
  const lower = (message ?? "").toLowerCase();
  return (
    lower.includes("company_jsas_status_check") ||
    (lower.includes("violates check constraint") && lower.includes("pending_review"))
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_create_documents", "can_submit_documents", "can_view_all_company_data"],
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
  if (!existing.data) return NextResponse.json({ error: "JSA not found." }, { status: 404 });

  const jobsiteScope = await getJobsiteAccessScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    companyId: companyScope.companyId,
    role: auth.role,
  });
  if (!isJobsiteAllowed(existing.data.jobsite_id ?? null, jobsiteScope)) {
    return NextResponse.json({ error: "You can only submit JSAs for assigned jobsites." }, { status: 403 });
  }

  let result = await auth.supabase
    .from("company_jsas")
    .update({
      status: "pending_review",
      updated_by: auth.user.id,
    })
    .eq("id", id)
    .eq("company_id", companyScope.companyId)
    .select("*")
    .single();

  if (result.error && isPendingReviewConstraintError(result.error.message)) {
    result = await auth.supabase
      .from("company_jsas")
      .update({
        status: "active",
        updated_by: auth.user.id,
      })
      .eq("id", id)
      .eq("company_id", companyScope.companyId)
      .select("*")
      .single();
  }

  if (result.error) {
    return NextResponse.json({ error: result.error.message || "Failed to send JSA for review." }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    reviewStatus: result.data.status === "pending_review" ? "pending_review" : "active",
    message:
      result.data.status === "pending_review"
        ? "JSA sent for company admin review."
        : "JSA submitted. Your workspace is using the legacy active status for submitted JSAs.",
    jsa: result.data,
  });
}
