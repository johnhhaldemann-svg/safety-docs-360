import { NextResponse } from "next/server";
import { sendCustomerAuditReportEmail } from "@/lib/auditReportEmail";
import { generateFieldAuditReportPdf } from "@/lib/fieldAudits/reportPdf";
import { getCompanyScope } from "@/lib/companyScope";
import { isJobsiteAllowed, getJobsiteAccessScope } from "@/lib/jobsiteAccess";
import { authorizeRequest, isAdminRole } from "@/lib/rbac";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type ReviewBody = {
  decision?: "approved" | "rejected";
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

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_view_all_company_data", "can_view_analytics", "can_manage_observations"],
  });
  if ("error" in auth) return auth.error;
  if (!isReviewRole(auth.role)) {
    return NextResponse.json(
      { error: "Only company admins and safety managers can review field audits." },
      { status: 403 }
    );
  }

  const { id } = await context.params;
  const auditId = String(id ?? "").trim();
  if (!auditId) return NextResponse.json({ error: "Audit id is required." }, { status: 400 });

  const body = (await request.json().catch(() => null)) as ReviewBody | null;
  const decision = body?.decision ?? "approved";
  if (decision !== "approved" && decision !== "rejected") {
    return NextResponse.json({ error: "decision must be approved or rejected." }, { status: 400 });
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

  const writeSupabase = createSupabaseAdminClient() ?? auth.supabase;
  const auditResult = await auth.supabase
    .from("company_jobsite_audits")
    .select("id, company_id, jobsite_id, audit_date, auditors, selected_trade, status, score_summary, payload, ai_review_id, ai_review_summary")
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

  const nextStatus = decision === "approved" ? "submitted" : "returned";
  const updateResult = await writeSupabase
    .from("company_jobsite_audits")
    .update({ status: nextStatus })
    .eq("company_id", companyScope.companyId)
    .eq("id", auditId)
    .select("id, status")
    .single();

  if (updateResult.error) {
    return NextResponse.json(
      { error: updateResult.error.message || "Failed to update field audit review status." },
      { status: 500 }
    );
  }

  if (audit.ai_review_id) {
    await writeSupabase
      .from("company_ai_reviews")
      .update({
        status: decision === "approved" ? "approved" : "rejected",
        approved_at: decision === "approved" ? new Date().toISOString() : null,
        updated_by: auth.user.id,
      })
      .eq("id", audit.ai_review_id)
      .eq("company_id", companyScope.companyId);
  }

  if (decision === "rejected") {
    return NextResponse.json({
      success: true,
      audit: updateResult.data,
      message: "Field audit sent back for corrections.",
    });
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
      {
        success: true,
        audit: updateResult.data,
        warning: jobsiteResult.error.message || "Audit approved, but customer email lookup failed.",
      },
      { status: 200 }
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

  const recipientEmail = String(
    customerResult.data?.report_email ?? jobsiteResult.data?.customer_report_email ?? ""
  )
    .trim()
    .toLowerCase();
  if (!recipientEmail) {
    return NextResponse.json({
      success: true,
      audit: updateResult.data,
      customerEmailSent: false,
      warning: customerResult.error?.message || null,
      message: "Field audit approved. No customer audit email is saved for this customer or jobsite yet.",
    });
  }

  const observationsResult = await auth.supabase
    .from("company_jobsite_audit_observations")
    .select("item_label, category_label, status, severity, notes")
    .eq("company_id", companyScope.companyId)
    .eq("audit_id", auditId)
    .order("created_at", { ascending: true });

  const reportPdf = await generateFieldAuditReportPdf({
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
    reportStatus: "approved",
  });

  const emailResult = await sendCustomerAuditReportEmail({
    toEmail: recipientEmail,
    companyName: companyScope.companyName || "Safety360 Docs",
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
    pdfAttachment: {
      filename: reportPdf.filename,
      contentBase64: Buffer.from(reportPdf.bytes).toString("base64"),
    },
  });

  const deliveryInsert = await writeSupabase
    .from("company_jobsite_audit_report_deliveries")
    .insert({
      company_id: companyScope.companyId,
      jobsite_id: audit.jobsite_id ?? null,
      audit_id: auditId,
      recipient_email: recipientEmail,
      status: emailResult.status,
      provider_message_id: "providerMessageId" in emailResult ? emailResult.providerMessageId : null,
      error_message: "warning" in emailResult ? emailResult.warning : null,
      created_by: auth.user.id,
      sent_at: emailResult.sent ? new Date().toISOString() : null,
    })
    .select("*")
    .single();

  return NextResponse.json({
    success: true,
    audit: updateResult.data,
    customerEmailSent: emailResult.sent,
    customerEmail: recipientEmail,
    pdfAttached: true,
    pdfFilename: reportPdf.filename,
    delivery: deliveryInsert.data ?? null,
    warning:
      observationsResult.error?.message ||
      deliveryInsert.error?.message ||
      customerResult.error?.message ||
      ("warning" in emailResult ? emailResult.warning : null),
    message: emailResult.sent
      ? "Field audit approved and finished PDF sent to the customer."
      : "Field audit approved, but the customer report email was not sent.",
  });
}
