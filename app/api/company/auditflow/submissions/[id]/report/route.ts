import { NextResponse } from "next/server";
import { blockIfCsepOnlyCompany } from "@/lib/csepApiGuard";
import { getCompanyScope } from "@/lib/companyScope";
import { getJobsiteAccessScope, isJobsiteAllowed } from "@/lib/jobsiteAccess";
import { authorizeRequest } from "@/lib/rbac";
import {
  canReviewAuditFlow,
  escapeAuditFlowHtml,
  itemKey,
  normalizeAuditFlowAnswers,
  parseAuditFlowTemplateSchema,
} from "@/lib/auditflow/schema";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function renderReport(params: {
  companyName: string;
  templateTitle: string;
  jobsiteName: string;
  submission: Record<string, unknown>;
  assignment: Record<string, unknown> | null;
  schema: ReturnType<typeof parseAuditFlowTemplateSchema>;
}) {
  const answers = normalizeAuditFlowAnswers(params.submission.answers);
  const score = params.submission.score_summary as Record<string, unknown> | null;
  const rows = params.schema.sections.flatMap((section) =>
    section.items.map((item) => {
      const answer = answers[itemKey(section.id, item.id)];
      const status = answer?.value ?? "missing";
      return `
        <tr>
          <td>${escapeAuditFlowHtml(section.title)}</td>
          <td>${escapeAuditFlowHtml(item.label)}</td>
          <td class="status status-${escapeAuditFlowHtml(status)}">${escapeAuditFlowHtml(status.toUpperCase())}</td>
          <td>${escapeAuditFlowHtml(answer?.comment ?? "")}</td>
          <td>${answer?.photoUrl ? `<a href="${escapeAuditFlowHtml(answer.photoUrl)}">${escapeAuditFlowHtml(answer.photoUrl)}</a>` : ""}</td>
        </tr>
      `;
    })
  ).join("");

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeAuditFlowHtml(params.templateTitle)} AuditFlow Report</title>
    <style>
      :root { color: #0f172a; font-family: Arial, sans-serif; }
      body { margin: 0; background: #f8fafc; }
      main { max-width: 1040px; margin: 0 auto; padding: 32px; background: white; min-height: 100vh; }
      header { border-bottom: 3px solid #2563eb; padding-bottom: 20px; margin-bottom: 24px; }
      h1 { margin: 0; font-size: 30px; }
      .meta { color: #475569; margin-top: 8px; line-height: 1.5; }
      .metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 24px 0; }
      .metric { border: 1px solid #dbe3ef; border-radius: 8px; padding: 14px; background: #f8fbff; }
      .metric span { display: block; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: .08em; }
      .metric strong { display: block; margin-top: 6px; font-size: 22px; }
      table { width: 100%; border-collapse: collapse; margin-top: 18px; font-size: 13px; }
      th, td { border: 1px solid #dbe3ef; padding: 10px; vertical-align: top; text-align: left; }
      th { background: #eff6ff; }
      .status { font-weight: 700; }
      .status-pass { color: #047857; }
      .status-fail { color: #b91c1c; }
      .status-na { color: #64748b; }
      .notes { white-space: pre-wrap; border: 1px solid #dbe3ef; border-radius: 8px; padding: 14px; background: #f8fafc; }
      @media print { body { background: white; } main { padding: 0; } .no-print { display: none; } }
    </style>
  </head>
  <body>
    <main>
      <button class="no-print" onclick="window.print()">Print report</button>
      <header>
        <h1>${escapeAuditFlowHtml(params.templateTitle)}</h1>
        <div class="meta">
          <div>${escapeAuditFlowHtml(params.companyName)} | ${escapeAuditFlowHtml(params.jobsiteName)}</div>
          <div>Status: ${escapeAuditFlowHtml(params.submission.status)} | Submitted: ${escapeAuditFlowHtml(params.submission.submitted_at)}</div>
          <div>Signature: ${escapeAuditFlowHtml(params.submission.signature_text)}</div>
        </div>
      </header>
      <section class="metrics">
        <div class="metric"><span>Score</span><strong>${escapeAuditFlowHtml(score?.compliancePercent ?? "--")}%</strong></div>
        <div class="metric"><span>Pass</span><strong>${escapeAuditFlowHtml(score?.pass ?? 0)}</strong></div>
        <div class="metric"><span>Fail</span><strong>${escapeAuditFlowHtml(score?.fail ?? 0)}</strong></div>
        <div class="metric"><span>N/A</span><strong>${escapeAuditFlowHtml(score?.na ?? 0)}</strong></div>
      </section>
      <h2>Checklist Results</h2>
      <table>
        <thead><tr><th>Section</th><th>Item</th><th>Status</th><th>Comment</th><th>Photo URL</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <h2>Submission Notes</h2>
      <div class="notes">${escapeAuditFlowHtml(params.submission.notes ?? "")}</div>
      <h2>Manager Review</h2>
      <div class="notes">${escapeAuditFlowHtml(params.submission.review_notes ?? "")}</div>
    </main>
  </body>
</html>`;
}

export async function GET(request: Request, context: RouteContext) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: [
      "can_access_field_audits",
      "can_view_reports",
      "can_view_all_company_data",
      "can_submit_documents",
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

  const submission = await auth.supabase
    .from("company_auditflow_submissions")
    .select("*")
    .eq("company_id", companyScope.companyId)
    .eq("id", submissionId)
    .maybeSingle();
  if (submission.error) return NextResponse.json({ error: submission.error.message || "Failed to load submission." }, { status: 500 });
  if (!submission.data) return NextResponse.json({ error: "Submission not found." }, { status: 404 });

  if (!canReviewAuditFlow(auth.role) && submission.data.submitted_by !== auth.user.id) {
    return NextResponse.json({ error: "You can only view your own AuditFlow reports." }, { status: 403 });
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

  const html = renderReport({
    companyName: companyScope.companyName || "SafePredict",
    templateTitle: String(template.data?.title ?? "AuditFlow Report"),
    jobsiteName: String(jobsite.data?.name ?? "No jobsite"),
    submission: submission.data,
    assignment: assignment.data ?? null,
    schema: parseAuditFlowTemplateSchema(version.data.schema),
  });

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
