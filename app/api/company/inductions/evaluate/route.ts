import { NextResponse } from "next/server";
import { authorizeRequest, isAdminRole } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { blockIfCsepOnlyCompany } from "@/lib/csepApiGuard";
import { getJobsiteAccessScope, isJobsiteAllowed } from "@/lib/jobsiteAccess";
import {
  evaluateInductionAccess,
  type InductionCompletionRow,
  type InductionProgramRow,
  type InductionRequirementRow,
} from "@/lib/inductions/evaluateAccess";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: [
      "can_view_all_company_data",
      "can_view_analytics",
      "can_view_dashboards",
      "can_manage_company_users",
      "can_create_documents",
    ],
  });
  if ("error" in auth) return auth.error;

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) {
    return NextResponse.json({ error: "No company workspace linked." }, { status: 400 });
  }

  const block = await blockIfCsepOnlyCompany(auth.supabase, companyScope.companyId);
  if (block) return block;

  const jobsiteScope = await getJobsiteAccessScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    companyId: companyScope.companyId,
    role: auth.role,
  });

  const { searchParams } = new URL(request.url);
  const jobsiteId = searchParams.get("jobsiteId")?.trim() ?? "";
  if (!jobsiteId) {
    return NextResponse.json({ error: "jobsiteId query parameter is required." }, { status: 400 });
  }
  if (!isJobsiteAllowed(jobsiteId, jobsiteScope)) {
    return NextResponse.json({ error: "Jobsite not allowed for your account." }, { status: 403 });
  }

  let subjectUserId = searchParams.get("userId")?.trim() ?? "";
  const visitorDisplayName = searchParams.get("visitorDisplayName")?.trim() || null;
  if (!subjectUserId && !visitorDisplayName) {
    subjectUserId = auth.user.id;
  }

  const canEvaluateOthers =
    isAdminRole(auth.role) ||
    auth.permissionMap?.can_view_all_company_data ||
    auth.permissionMap?.can_manage_company_users;
  if (subjectUserId && subjectUserId !== auth.user.id && !canEvaluateOthers) {
    return NextResponse.json({ error: "You can only evaluate your own access." }, { status: 403 });
  }

  const [programsRes, reqsRes, completionsRes] = await Promise.all([
    auth.supabase
      .from("company_induction_programs")
      .select("id, name, audience, active")
      .eq("company_id", companyScope.companyId),
    auth.supabase
      .from("company_induction_requirements")
      .select("id, program_id, jobsite_id, active, effective_from, effective_to")
      .eq("company_id", companyScope.companyId),
    auth.supabase
      .from("company_induction_completions")
      .select("program_id, jobsite_id, user_id, visitor_display_name, expires_at, completed_at")
      .eq("company_id", companyScope.companyId),
  ]);

  if (programsRes.error || reqsRes.error || completionsRes.error) {
    const msg =
      programsRes.error?.message ||
      reqsRes.error?.message ||
      completionsRes.error?.message ||
      "Failed to load induction data.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const programs = (programsRes.data ?? []) as InductionProgramRow[];
  const requirements = (reqsRes.data ?? []) as InductionRequirementRow[];
  let completions = (completionsRes.data ?? []) as InductionCompletionRow[];

  if (subjectUserId) {
    completions = completions.filter((c) => c.user_id === subjectUserId);
  } else if (visitorDisplayName) {
    completions = completions.filter(
      (c) =>
        c.visitor_display_name &&
        c.visitor_display_name.trim().toLowerCase() === visitorDisplayName.trim().toLowerCase()
    );
  }

  const result = evaluateInductionAccess({
    jobsiteId,
    subjectUserId: subjectUserId || null,
    visitorDisplayName,
    programs,
    requirements,
    completions,
  });

  const contractorId = searchParams.get("contractorId")?.trim() ?? "";
  const reasons = [...result.reasons];
  let status: "eligible" | "blocked" = result.status;
  if (contractorId && canEvaluateOthers) {
    const docs = await auth.supabase
      .from("company_contractor_documents")
      .select("id, title, doc_type, expires_on")
      .eq("company_id", companyScope.companyId)
      .eq("contractor_id", contractorId);
    if (!docs.error && docs.data?.length) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      for (const row of docs.data) {
        const exp = row.expires_on ? new Date(String(row.expires_on)) : null;
        if (exp && !Number.isNaN(exp.getTime()) && exp < today) {
          status = "blocked";
          reasons.push(`Contractor document expired: ${row.title} (${row.doc_type})`);
        }
      }
    }
  }

  return NextResponse.json({
    jobsiteId,
    subjectUserId: subjectUserId || null,
    visitorDisplayName,
    contractorId: contractorId || null,
    status,
    missingProgramIds: result.missingProgramIds,
    reasons,
  });
}
