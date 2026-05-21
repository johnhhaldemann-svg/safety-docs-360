import { NextResponse } from "next/server";
import { GET } from "@/app/api/company/jsas/route";
import { authorizeRequest } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { getJobsiteAccessScope, isJobsiteAllowed } from "@/lib/jobsiteAccess";
import { blockIfCsepOnlyCompany } from "@/lib/csepApiGuard";

export const runtime = "nodejs";

export { GET };

const MOBILE_JSA_STATUSES = new Set(["draft", "pending_review", "active", "closed", "archived"]);

function normalizeMobileJsaStatus(input: unknown, fallback = "draft") {
  const value = String(input ?? "").trim().toLowerCase();
  return MOBILE_JSA_STATUSES.has(value) ? value : fallback;
}

export async function POST(request: Request) {
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

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const title = String(body?.title ?? "").trim();
  if (!title) return NextResponse.json({ error: "JSA title is required." }, { status: 400 });

  let jobsiteId = String(body?.jobsiteId ?? "").trim() || null;
  const jobsiteScope = await getJobsiteAccessScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    companyId: companyScope.companyId,
    role: auth.role,
  });
  if (jobsiteScope.restricted && !jobsiteId && jobsiteScope.jobsiteIds.length > 0) {
    jobsiteId = jobsiteScope.jobsiteIds[0] ?? null;
  }
  if (!isJobsiteAllowed(jobsiteId, jobsiteScope)) {
    return NextResponse.json(
      {
        error:
          jobsiteScope.restricted && jobsiteScope.jobsiteIds.length < 1
            ? "You need a jobsite assignment before creating a mobile JSA."
            : "You can only create JSAs for assigned jobsites.",
      },
      { status: 403 }
    );
  }

  const result = await auth.supabase
    .from("company_jsas")
    .insert({
      company_id: companyScope.companyId,
      jobsite_id: jobsiteId,
      title,
      description: String(body?.description ?? "").trim() || null,
      status: normalizeMobileJsaStatus(body?.status, "draft"),
      severity: String(body?.severity ?? "").trim().toLowerCase() || "medium",
      category: String(body?.category ?? "").trim().toLowerCase() || "corrective_action",
      owner_user_id: String(body?.ownerUserId ?? "").trim() || null,
      due_at: String(body?.dueAt ?? "").trim() || null,
      created_by: auth.user.id,
      updated_by: auth.user.id,
    })
    .select("*")
    .single();

  if (result.error) {
    return NextResponse.json({ error: result.error.message || "Failed to create mobile JSA." }, { status: 500 });
  }
  return NextResponse.json({ success: true, jsa: result.data });
}
