import { NextResponse } from "next/server";
import { generateFieldAuditReportPdf } from "@/lib/fieldAudits/reportPdf";
import { getCompanyScope } from "@/lib/companyScope";
import { isJobsiteAllowed, getJobsiteAccessScope } from "@/lib/jobsiteAccess";
import { authorizeRequest, isAdminRole } from "@/lib/rbac";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function isReviewRole(role?: string | null) {
  return (
    isAdminRole(role) ||
    role === "company_admin" ||
    role === "manager" ||
    role === "safety_manager"
  );
}

function getHoursBilled(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const value = (payload as Record<string, unknown>).hoursBilled;
  const parsed = typeof value === "number" ? value : Number(String(value ?? "").trim());
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function safeFilename(filename: string) {
  return filename.replace(/[^a-z0-9._-]+/gi, "-");
}

export async function GET(request: Request, context: RouteContext) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_view_all_company_data", "can_view_analytics", "can_manage_observations"],
  });
  if ("error" in auth) return auth.error;
  if (!isReviewRole(auth.role)) {
    return NextResponse.json(
      { error: "Only company admins and safety managers can view field audit reports." },
      { status: 403 }
    );
  }

  const { id } = await context.params;
  const auditId = String(id ?? "").trim();
  if (!auditId) return NextResponse.json({ error: "Audit id is required." }, { status: 400 });

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) {
    return NextResponse.json({ error: "No company scope found." }, { status: 400 });
  }

  const auditResult = await auth.supabase
    .from("company_jobsite_audits")
    .select("id, company_id, jobsite_id, audit_date, auditors, selected_trade, status, score_summary, payload, ai_review_summary")
    .eq("company_id", companyScope.companyId)
    .eq("id", auditId)
    .maybeSingle();

  if (auditResult.error) {
    return NextResponse.json(
      { error: auditResult.error.message || "Failed to load field audit." },
      { status: 500 }
    );
  }
  if (!auditResult.data) return NextResponse.json({ error: "Field audit not found." }, { status: 404 });

  const audit = auditResult.data;
  const jobsiteScope = await getJobsiteAccessScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    companyId: companyScope.companyId,
    role: auth.role,
  });
  if (!isJobsiteAllowed((audit.jobsite_id as string | null) ?? null, jobsiteScope)) {
    return NextResponse.json({ error: "Audit access denied for this jobsite." }, { status: 403 });
  }

  const jobsiteResult = audit.jobsite_id
    ? await auth.supabase
        .from("company_jobsites")
        .select("id, name, audit_customer_id, customer_report_email")
        .eq("company_id", companyScope.companyId)
        .eq("id", audit.jobsite_id)
        .maybeSingle()
    : { data: null, error: null };

  if (jobsiteResult.error) {
    return NextResponse.json(
      { error: jobsiteResult.error.message || "Failed to load jobsite for report." },
      { status: 500 }
    );
  }

  const customerResult = jobsiteResult.data?.audit_customer_id
    ? await auth.supabase
        .from("company_audit_customers")
        .select("id, name, report_email")
        .eq("company_id", companyScope.companyId)
        .eq("id", jobsiteResult.data.audit_customer_id)
        .maybeSingle()
    : { data: null, error: null };

  if (customerResult.error) {
    return NextResponse.json(
      { error: customerResult.error.message || "Failed to load customer for report." },
      { status: 500 }
    );
  }

  const observationsResult = await auth.supabase
    .from("company_jobsite_audit_observations")
    .select("item_label, category_label, status, severity, notes")
    .eq("company_id", companyScope.companyId)
    .eq("audit_id", auditId)
    .order("created_at", { ascending: true });

  if (observationsResult.error) {
    return NextResponse.json(
      { error: observationsResult.error.message || "Failed to load report observations." },
      { status: 500 }
    );
  }

  const report = await generateFieldAuditReportPdf({
    companyName: companyScope.companyName || "Safety360 Docs",
    customerName: customerResult.data?.name ?? null,
    jobsiteName: String(jobsiteResult.data?.name ?? "Jobsite"),
    auditDate: (audit.audit_date as string | null) ?? null,
    auditors: (audit.auditors as string | null) ?? null,
    hoursBilled: getHoursBilled(audit.payload),
    selectedTrade: (audit.selected_trade as string | null) ?? null,
    scoreSummary:
      audit.score_summary && typeof audit.score_summary === "object"
        ? (audit.score_summary as Record<string, unknown>)
        : {},
    aiReviewSummary:
      audit.ai_review_summary && typeof audit.ai_review_summary === "object"
        ? (audit.ai_review_summary as Record<string, unknown>)
        : null,
    observations: observationsResult.data ?? [],
    reviewerName: auth.user.email ?? null,
    reportStatus: audit.status === "submitted" ? "approved" : "preview",
  });

  return new Response(report.bytes as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${safeFilename(report.filename)}"`,
      "Cache-Control": "no-store",
    },
  });
}
