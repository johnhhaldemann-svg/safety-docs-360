import type { AuditReportEmailObservation } from "@/lib/auditReportEmail";
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
  type AuditPdfFinding,
} from "@/lib/auditReports/csepStylePdf";

type FieldAuditReportPdfParams = {
  companyName: string;
  customerName?: string | null;
  jobsiteName: string;
  auditDate: string | null;
  auditors: string | null;
  hoursBilled?: number | null;
  selectedTrade: string | null;
  scoreSummary: Record<string, unknown>;
  aiReviewSummary?: Record<string, unknown> | null;
  observations: AuditReportEmailObservation[];
  reviewerName?: string | null;
  reportStatus?: "preview" | "approved";
};

function formatTrade(value: string | null) {
  return cleanAuditPdfText(value, "Field audit").replaceAll("_", " ");
}

function formatPercent(value: unknown) {
  return typeof value === "number" ? `${value}%` : "--";
}

function getScoreValue(score: Record<string, unknown>, key: string) {
  const value = score[key];
  return typeof value === "number" ? value : 0;
}

function getNestedString(record: Record<string, unknown> | null | undefined, key: string) {
  const value = record?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getPdfSummary(summary: Record<string, unknown> | null | undefined) {
  const emailSummary =
    summary?.emailSummary && typeof summary.emailSummary === "object"
      ? (summary.emailSummary as Record<string, unknown>)
      : null;
  const highlights = Array.isArray(emailSummary?.findingHighlights)
    ? emailSummary.findingHighlights.filter(
        (item): item is string => typeof item === "string" && item.trim().length > 0
      )
    : [];
  return {
    openingSummary:
      getNestedString(emailSummary, "openingSummary") ||
      getNestedString(summary, "correctedReportSummary") ||
      getNestedString(summary, "executiveSummary"),
    findingHighlights: highlights,
  };
}

function findingTone(severity: string | null | undefined): AuditPdfFinding["tone"] {
  const normalized = String(severity ?? "").toLowerCase();
  if (normalized === "critical") return "critical";
  if (normalized === "high") return "warning";
  return "neutral";
}

function buildChecklistRows(observations: AuditReportEmailObservation[]): AuditPdfChecklistRow[] {
  return observations.map((observation) => ({
    section: cleanAuditPdfText(observation.category_label, "Audit item"),
    item: cleanAuditPdfText(observation.item_label, "Checklist item"),
    status: cleanAuditPdfText(observation.status, "missing"),
    comment: cleanAuditPdfText(observation.notes, "No field notes were provided."),
    evidence: cleanAuditPdfText(observation.severity, "medium"),
  }));
}

export async function generateFieldAuditReportPdf(params: FieldAuditReportPdfParams) {
  const writer = await createAuditPdfWriter();
  const compliance = formatPercent(params.scoreSummary.compliancePercent);
  const findingCount = getScoreValue(params.scoreSummary, "fail");
  const scoredCount =
    getScoreValue(params.scoreSummary, "total") || getScoreValue(params.scoreSummary, "totalItems");
  const aiSummary = getPdfSummary(params.aiReviewSummary);
  const failedObservations = params.observations.filter((observation) => observation.status === "fail");
  const reportStatus = params.reportStatus === "approved" ? "approved" : "preview";
  const jobsiteName = cleanAuditPdfText(params.jobsiteName, "Audit location");
  const auditDate = cleanAuditPdfText(params.auditDate, "Not specified");

  drawAuditPdfCover({
    writer,
    title: "Finished Field Audit Report",
    subtitle: "CSEP-style approved audit package",
    companyName: cleanAuditPdfText(params.companyName, "SafePredict"),
    jobsiteName,
    reportStatus,
    metadata: [
      { label: "Customer", value: cleanAuditPdfText(params.customerName, "Not specified") },
      { label: "Audit date", value: auditDate },
      { label: "Auditor(s)", value: cleanAuditPdfText(params.auditors) },
      { label: "Trade / scope", value: formatTrade(params.selectedTrade) },
    ],
  });

  drawAuditPdfSectionTitle(writer, "Executive summary");
  drawAuditPdfMetrics(writer, [
    { label: "Compliance", value: compliance },
    { label: "Findings", value: String(findingCount) },
    { label: "Scored items", value: String(scoredCount || "--") },
    {
      label: "Hours",
      value: typeof params.hoursBilled === "number" ? String(params.hoursBilled) : "--",
    },
  ]);
  drawAuditPdfText(
    writer,
    aiSummary.openingSummary ||
      "This field audit report summarizes reviewed checklist results, failed findings, and approval context for the selected jobsite.",
    { size: 10, lineGap: 5 }
  );

  drawAuditPdfSectionTitle(writer, "Report details");
  drawAuditPdfKeyValue(writer, "Company", cleanAuditPdfText(params.companyName, "SafePredict"));
  drawAuditPdfKeyValue(writer, "Customer", cleanAuditPdfText(params.customerName, "Not specified"));
  drawAuditPdfKeyValue(writer, "Jobsite", jobsiteName);
  drawAuditPdfKeyValue(writer, "Audit date", auditDate);
  drawAuditPdfKeyValue(writer, "Auditor(s)", cleanAuditPdfText(params.auditors));
  drawAuditPdfKeyValue(writer, "Trade / scope", formatTrade(params.selectedTrade));

  drawAuditPdfSectionTitle(writer, "Findings summary");
  if (aiSummary.findingHighlights.length > 0) {
    aiSummary.findingHighlights.slice(0, 12).forEach((finding, index) => {
      drawAuditPdfFinding(writer, {
        title: `Finding ${index + 1}`,
        detail: "AI-reviewed report highlight",
        notes: finding,
        tone: "warning",
      });
    });
  } else if (failedObservations.length > 0) {
    failedObservations.slice(0, 18).forEach((finding) => {
      drawAuditPdfFinding(writer, {
        title: cleanAuditPdfText(finding.item_label, "Finding"),
        detail: `${cleanAuditPdfText(finding.category_label, "Audit item")} | Severity: ${cleanAuditPdfText(finding.severity, "medium")}`,
        notes: cleanAuditPdfText(finding.notes, "Corrective action required. No field notes were provided."),
        tone: findingTone(finding.severity),
      });
    });
  } else {
    drawAuditPdfFinding(writer, {
      title: "No failed checklist items recorded",
      detail: "Checklist result",
      notes: "No failed checklist items were recorded in this audit.",
      tone: "success",
    });
  }

  drawAuditPdfSectionTitle(writer, "Checklist detail");
  const checklistRows = buildChecklistRows(params.observations);
  if (checklistRows.length > 0) {
    drawAuditPdfChecklistRows(writer, checklistRows);
  } else {
    drawAuditPdfText(writer, "No checklist observations were available for this audit.", { size: 10 });
  }

  drawAuditPdfSectionTitle(writer, "Approval record");
  drawAuditPdfKeyValue(
    writer,
    "Approval status",
    reportStatus === "approved" ? "Approved customer copy" : "Reviewer preview"
  );
  drawAuditPdfKeyValue(writer, "Reviewer", cleanAuditPdfText(params.reviewerName, "Company admin"));
  drawAuditPdfText(
    writer,
    reportStatus === "approved"
      ? "This report was reviewed and approved by the company admin or authorized safety manager before customer delivery."
      : "This PDF is a reviewer preview. Approve the audit before relying on this as the downloadable final customer copy.",
    { size: 9, lineGap: 4 }
  );
  drawAuditPdfDisclaimer(writer);

  const bytes = await finalizeAuditPdf(writer);
  const datePart = sanitizeAuditPdfFilePart(params.auditDate || new Date().toISOString().slice(0, 10));
  const jobsitePart = sanitizeAuditPdfFilePart(params.jobsiteName || "jobsite");
  return {
    bytes,
    filename: `${jobsitePart}-field-audit-${datePart}.pdf`,
  };
}
