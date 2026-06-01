import { NextResponse } from "next/server";
import { blockIfCsepOnlyCompany } from "@/lib/csepApiGuard";
import { getCompanyScope } from "@/lib/companyScope";
import { getJobsiteAccessScope, isJobsiteAllowed } from "@/lib/jobsiteAccess";
import { authorizeRequest } from "@/lib/rbac";
import { canReviewAuditFlow, parseAuditFlowTemplateSchema } from "@/lib/auditflow/schema";
import { generateAuditFlowReportPdf } from "@/lib/auditflow/reportPdf";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function safeFilename(filename: string) {
  return filename.replace(/[^a-z0-9._-]+/gi, "-");
}

export async function GET(request: Request, context: RouteContext) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: [
      "can_access_field_audits",
      "can_view_reports",
      "can_view_all_company_data",
      "can_submit_documents",
      "can_manage_observations",
    ],
  });
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  const submissionId = String(id ?? "").trim();
  if (!submissionId) return NextResponse.json({ error: "Submission id is required." }, { status: 400 });

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) return NextResponse.json({ error: "No company workspace." }, { status: 400 });

  const block = await blockIfCsepOnlyCompany(auth.supabase, companyScope.companyId);
  if (block) return block;

  const wantsPreview = new URL(request.url).searchParams.get("preview") === "1";
  const isReviewer = canReviewAuditFlow(auth.role);

  const submission = await auth.supabase
    .from("company_auditflow_submissions")
    .select("*")
    .eq("company_id", companyScope.companyId)
    .eq("id", submissionId)
    .maybeSingle();
  if (submission.error) {
    return NextResponse.json({ error: submission.error.message || "Failed to load submission." }, { status: 500 });
  }
  if (!submission.data) return NextResponse.json({ error: "Submission not found." }, { status: 404 });

  const isSubmitter = submission.data.submitted_by === auth.user.id;
  const isApproved = submission.data.status === "approved";
  if (wantsPreview) {
    if (!isReviewer) {
      return NextResponse.json({ error: "Only company reviewers can preview AuditFlow PDFs before approval." }, { status: 403 });
    }
    if (isApproved) {
      return NextResponse.json({ error: "Use the approved download for approved AuditFlow reports." }, { status: 400 });
    }
  } else if (!isApproved) {
    return NextResponse.json({ error: "This AuditFlow PDF is available after company review approval." }, { status: 403 });
  } else if (!isReviewer && !isSubmitter) {
    return NextResponse.json({ error: "You can only download your own approved AuditFlow reports." }, { status: 403 });
  }

  const jobsiteScope = await getJobsiteAccessScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    companyId: companyScope.companyId,
    role: auth.role,
  });
  if (!isJobsiteAllowed(submission.data.jobsite_id ?? null, jobsiteScope)) {
    return NextResponse.json({ error: "Report access denied for this jobsite." }, { status: 403 });
  }

  const [assignment, version, template, jobsite] = await Promise.all([
    auth.supabase
      .from("company_auditflow_assignments")
      .select("*")
      .eq("company_id", companyScope.companyId)
      .eq("id", submission.data.assignment_id)
      .maybeSingle(),
    auth.supabase
      .from("company_auditflow_template_versions")
      .select("*")
      .eq("company_id", companyScope.companyId)
      .eq("id", submission.data.template_version_id)
      .maybeSingle(),
    auth.supabase
      .from("company_auditflow_templates")
      .select("title")
      .eq("company_id", companyScope.companyId)
      .eq("id", submission.data.template_id)
      .maybeSingle(),
    submission.data.jobsite_id
      ? auth.supabase
          .from("company_jobsites")
          .select("name")
          .eq("company_id", companyScope.companyId)
          .eq("id", submission.data.jobsite_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (version.error || !version.data) {
    return NextResponse.json({ error: version.error?.message || "Template version not found." }, { status: 500 });
  }
  if (assignment.error || template.error || jobsite.error) {
    return NextResponse.json(
      { error: assignment.error?.message || template.error?.message || jobsite.error?.message || "Failed to load report context." },
      { status: 500 }
    );
  }

  const report = await generateAuditFlowReportPdf({
    companyName: companyScope.companyName || "SafePredict",
    templateTitle: String(template.data?.title ?? "AuditFlow Report"),
    jobsiteName: String(jobsite.data?.name ?? "No jobsite"),
    submission: submission.data,
    assignment: assignment.data ?? null,
    schema: parseAuditFlowTemplateSchema(version.data.schema),
    reviewerName: auth.user.email ?? null,
    reportStatus: wantsPreview ? "preview" : "approved",
  });

  return new Response(report.bytes as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${wantsPreview ? "inline" : "attachment"}; filename="${safeFilename(report.filename)}"`,
      "Cache-Control": "no-store",
    },
  });
}
