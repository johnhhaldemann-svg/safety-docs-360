import {
  itemKey,
  normalizeAuditFlowAnswers,
  scoreAuditFlowSubmission,
  type AuditFlowTemplateSchema,
} from "@/lib/auditflow/schema";
import {
  cleanAuditPdfText,
  createAuditPdfWriter,
  drawAuditPdfChecklistRows,
  drawAuditPdfCover,
  drawAuditPdfDisclaimer,
  drawAuditPdfFinding,
  drawAuditPdfKeyValue,
  drawAuditPdfMetrics,
  drawAuditPdfSectionTitle,
  drawAuditPdfText,
  finalizeAuditPdf,
  sanitizeAuditPdfFilePart,
  type AuditPdfChecklistRow,
} from "@/lib/auditReports/csepStylePdf";

export type AuditFlowReportPdfParams = {
  companyName: string;
  templateTitle: string;
  jobsiteName: string;
  submission: Record<string, unknown>;
  assignment?: Record<string, unknown> | null;
  schema: AuditFlowTemplateSchema;
  reviewerName?: string | null;
  reportStatus?: "preview" | "approved";
};

function getScoreSummary(params: AuditFlowReportPdfParams) {
  const answers = normalizeAuditFlowAnswers(params.submission.answers);
  const calculated = scoreAuditFlowSubmission(params.schema, answers);
  const raw =
    params.submission.score_summary && typeof params.submission.score_summary === "object"
      ? (params.submission.score_summary as Record<string, unknown>)
      : {};
  return {
    ...calculated,
    compliancePercent:
      typeof raw.compliancePercent === "number" ? raw.compliancePercent : calculated.compliancePercent,
    pass: typeof raw.pass === "number" ? raw.pass : calculated.pass,
    fail: typeof raw.fail === "number" ? raw.fail : calculated.fail,
    na: typeof raw.na === "number" ? raw.na : calculated.na,
    totalItems: typeof raw.totalItems === "number" ? raw.totalItems : calculated.totalItems,
    failedItems: calculated.failedItems,
  };
}

function formatDateTime(value: unknown) {
  const text = typeof value === "string" ? value : "";
  if (!text) return "Not specified";
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text;
  return date.toISOString().slice(0, 10);
}

function buildChecklistRows(params: AuditFlowReportPdfParams): AuditPdfChecklistRow[] {
  const answers = normalizeAuditFlowAnswers(params.submission.answers);
  return params.schema.sections.flatMap((section) =>
    section.items.map((item) => {
      const answer = answers[itemKey(section.id, item.id)];
      return {
        section: section.title,
        item: item.label,
        status: answer?.value ?? "missing",
        comment: cleanAuditPdfText(answer?.comment, answer?.value === "fail" ? "No fail comment provided." : ""),
        evidence: answer?.photoUrl ?? "",
      };
    })
  );
}

export async function generateAuditFlowReportPdf(params: AuditFlowReportPdfParams) {
  const writer = await createAuditPdfWriter();
  const reportStatus = params.reportStatus === "approved" ? "approved" : "preview";
  const score = getScoreSummary(params);
  const checklistRows = buildChecklistRows(params);
  const failedRows = checklistRows.filter((row) => row.status === "fail");
  const submittedAt = formatDateTime(params.submission.submitted_at);
  const reviewedAt = formatDateTime(params.submission.reviewed_at);
  const templateTitle = cleanAuditPdfText(params.templateTitle, "AuditFlow Report");
  const jobsiteName = cleanAuditPdfText(params.jobsiteName, "No jobsite");

  drawAuditPdfCover({
    writer,
    title: "AuditFlow Report",
    subtitle: "CSEP-style approved audit package",
    companyName: cleanAuditPdfText(params.companyName, "SafePredict"),
    jobsiteName,
    reportStatus,
    metadata: [
      { label: "Template", value: templateTitle },
      { label: "Submitted", value: submittedAt },
      { label: "Signature", value: cleanAuditPdfText(params.submission.signature_text) },
      { label: "Reviewer", value: cleanAuditPdfText(params.reviewerName, "Company reviewer") },
    ],
  });

  drawAuditPdfSectionTitle(writer, "Executive summary");
  drawAuditPdfMetrics(writer, [
    {
      label: "Score",
      value: typeof score.compliancePercent === "number" ? `${score.compliancePercent}%` : "--",
    },
    { label: "Pass", value: String(score.pass) },
    { label: "Fail", value: String(score.fail) },
    { label: "N/A", value: String(score.na) },
  ]);
  drawAuditPdfText(
    writer,
    "This AuditFlow report summarizes a completed checklist submission, score results, findings, signoff, and company review status.",
    { size: 10, lineGap: 5 }
  );

  drawAuditPdfSectionTitle(writer, "Report details");
  drawAuditPdfKeyValue(writer, "Company", cleanAuditPdfText(params.companyName, "SafePredict"));
  drawAuditPdfKeyValue(writer, "Jobsite", jobsiteName);
  drawAuditPdfKeyValue(writer, "Template", templateTitle);
  drawAuditPdfKeyValue(writer, "Submitted", submittedAt);
  drawAuditPdfKeyValue(writer, "Signature", cleanAuditPdfText(params.submission.signature_text));
  drawAuditPdfKeyValue(writer, "Submission notes", cleanAuditPdfText(params.submission.notes, "None"));

  drawAuditPdfSectionTitle(writer, "Findings summary");
  if (failedRows.length > 0) {
    failedRows.slice(0, 18).forEach((row, index) => {
      drawAuditPdfFinding(writer, {
        title: `${index + 1}. ${row.item}`,
        detail: `${row.section} | Status: FAIL`,
        notes: row.comment || "Corrective action review required.",
        tone: "warning",
      });
    });
  } else {
    drawAuditPdfFinding(writer, {
      title: "No failed checklist items recorded",
      detail: "Checklist result",
      notes: "No failed checklist items were recorded in this AuditFlow submission.",
      tone: "success",
    });
  }

  drawAuditPdfSectionTitle(writer, "Checklist detail");
  if (checklistRows.length > 0) {
    drawAuditPdfChecklistRows(writer, checklistRows);
  } else {
    drawAuditPdfText(writer, "No checklist rows were available for this AuditFlow submission.", { size: 10 });
  }

  drawAuditPdfSectionTitle(writer, "Approval record");
  drawAuditPdfKeyValue(
    writer,
    "Approval status",
    reportStatus === "approved" ? "Approved customer copy" : "Reviewer preview"
  );
  drawAuditPdfKeyValue(writer, "Reviewed at", reportStatus === "approved" ? reviewedAt : "Pending approval");
  drawAuditPdfKeyValue(writer, "Reviewed by", cleanAuditPdfText(params.reviewerName, "Company reviewer"));
  drawAuditPdfKeyValue(writer, "Review notes", cleanAuditPdfText(params.submission.review_notes, "None"));
  drawAuditPdfDisclaimer(writer);

  const bytes = await finalizeAuditPdf(writer);
  const titlePart = sanitizeAuditPdfFilePart(templateTitle);
  const datePart = sanitizeAuditPdfFilePart(
    typeof params.submission.submitted_at === "string"
      ? params.submission.submitted_at.slice(0, 10)
      : new Date().toISOString().slice(0, 10)
  );
  return {
    bytes,
    filename: `${titlePart}-auditflow-${datePart}.pdf`,
  };
}
