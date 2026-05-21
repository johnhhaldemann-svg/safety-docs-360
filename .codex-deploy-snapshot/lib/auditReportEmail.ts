function readEnv(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function getAuditReportFromEmail() {
  return (
    readEnv("AUDIT_REPORT_FROM_EMAIL") ??
    readEnv("BILLING_FROM_EMAIL") ??
    readEnv("RESEND_FROM_EMAIL")
  );
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function cleanSubject(value: string) {
  return value.replace(/[\r\n]+/g, " ").trim();
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

function getEmailSummary(summary: Record<string, unknown> | null | undefined) {
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

export type AuditReportEmailObservation = {
  item_label?: string | null;
  category_label?: string | null;
  status?: string | null;
  severity?: string | null;
  notes?: string | null;
};

export async function sendCustomerAuditReportEmail(params: {
  toEmail: string;
  companyName: string;
  jobsiteName: string;
  auditDate: string | null;
  auditors: string | null;
  hoursBilled?: number | null;
  selectedTrade: string | null;
  scoreSummary: Record<string, unknown>;
  aiReviewSummary?: Record<string, unknown> | null;
  observations: AuditReportEmailObservation[];
  pdfAttachment?: {
    filename: string;
    contentBase64: string;
  } | null;
}) {
  const resendApiKey = readEnv("RESEND_API_KEY");
  const fromEmail = getAuditReportFromEmail();

  if (!resendApiKey || !fromEmail) {
    return {
      sent: false,
      status: "skipped" as const,
      warning:
        "Audit report email was not sent because email delivery is not configured. Add RESEND_API_KEY and AUDIT_REPORT_FROM_EMAIL in Vercel.",
    };
  }

  const safeCompanyName = escapeHtml(params.companyName || "Safety360 Docs");
  const safeJobsiteName = escapeHtml(params.jobsiteName || "Jobsite");
  const safeAuditDate = escapeHtml(params.auditDate || "Not specified");
  const safeAuditors = escapeHtml(params.auditors || "Not specified");
  const safeHoursBilled = escapeHtml(
    typeof params.hoursBilled === "number" ? String(params.hoursBilled) : "Not specified"
  );
  const safeTrade = escapeHtml((params.selectedTrade || "Field audit").replaceAll("_", " "));
  const compliance = formatPercent(params.scoreSummary.compliancePercent);
  const findingCount = getScoreValue(params.scoreSummary, "fail");
  const scoredCount = getScoreValue(params.scoreSummary, "total");
  const aiEmailSummary = getEmailSummary(params.aiReviewSummary);
  const topFindings = params.observations
    .filter((observation) => observation.status === "fail")
    .slice(0, 12);

  const findingsHtml =
    aiEmailSummary.findingHighlights.length > 0
      ? aiEmailSummary.findingHighlights
          .slice(0, 12)
          .map((finding) => `<li style="margin:0 0 14px;">${escapeHtml(finding)}</li>`)
          .join("")
      : topFindings.length > 0
      ? topFindings
          .map((finding) => {
            const title = escapeHtml(finding.item_label || "Finding");
            const category = escapeHtml(finding.category_label || "Audit item");
            const severity = escapeHtml(finding.severity || "medium");
            const notes = escapeHtml(finding.notes || "No notes provided.");
            return `<li style="margin:0 0 14px;"><strong>${title}</strong><br /><span style="color:#475569;">${category} | Severity: ${severity}</span><br /><span>${notes}</span></li>`;
          })
          .join("")
      : `<li style="margin:0;">No failed checklist items were recorded.</li>`;

  const subject = `Approved audit report for ${cleanSubject(params.jobsiteName || "jobsite")}`;
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a;max-width:720px;margin:0 auto;padding:24px;">
      <div style="border:1px solid #dbeafe;border-radius:20px;padding:28px;background:#ffffff;">
        <p style="font-size:12px;letter-spacing:0.22em;text-transform:uppercase;color:#0369a1;font-weight:700;margin:0 0 10px;">Approved Field Audit Report</p>
        <h1 style="font-size:26px;line-height:1.2;margin:0 0 14px;">${safeJobsiteName}</h1>
        <p style="margin:0 0 18px;color:#475569;">${safeCompanyName} approved this audit report and sent you the finished PDF for your records.</p>
        <div style="border:1px solid #e2e8f0;border-radius:16px;padding:16px 18px;background:#f8fafc;margin-bottom:22px;">
          <p style="margin:0 0 8px;"><strong>Audit date:</strong> ${safeAuditDate}</p>
          <p style="margin:0 0 8px;"><strong>Auditor(s):</strong> ${safeAuditors}</p>
          <p style="margin:0 0 8px;"><strong>Trade/scope:</strong> ${safeTrade}</p>
          <p style="margin:0 0 8px;"><strong>Compliance:</strong> ${escapeHtml(compliance)}</p>
          <p style="margin:0 0 8px;"><strong>Findings:</strong> ${findingCount} of ${scoredCount} scored items</p>
          <p style="margin:0;"><strong>Hours billed:</strong> ${safeHoursBilled}</p>
        </div>
        ${
          aiEmailSummary.openingSummary
            ? `<div style="border:1px solid #bfdbfe;border-radius:16px;padding:16px 18px;background:#eff6ff;margin-bottom:22px;">
          <p style="font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#1d4ed8;font-weight:700;margin:0 0 8px;">Reviewed Summary</p>
          <p style="margin:0;">${escapeHtml(aiEmailSummary.openingSummary)}</p>
        </div>`
            : ""
        }
        <h2 style="font-size:18px;margin:0 0 12px;">Findings Summary</h2>
        <ul style="padding-left:20px;margin:0;">${findingsHtml}</ul>
      </div>
    </div>
  `.trim();

  const findingsText =
    aiEmailSummary.findingHighlights.length > 0
      ? aiEmailSummary.findingHighlights.map((finding) => `- ${finding}`).join("\n")
      : topFindings.length > 0
      ? topFindings
          .map(
            (finding) =>
              `- ${finding.item_label || "Finding"} (${finding.category_label || "Audit item"}, ${finding.severity || "medium"}): ${finding.notes || "No notes provided."}`
          )
          .join("\n")
      : "- No failed checklist items were recorded.";

  const text = [
    `Approved field audit report: ${params.jobsiteName || "Jobsite"}`,
    `Company: ${params.companyName || "Safety360 Docs"}`,
    `Audit date: ${params.auditDate || "Not specified"}`,
    `Auditor(s): ${params.auditors || "Not specified"}`,
    `Trade/scope: ${(params.selectedTrade || "Field audit").replaceAll("_", " ")}`,
    `Compliance: ${compliance}`,
    `Findings: ${findingCount} of ${scoredCount} scored items`,
    `Hours billed: ${typeof params.hoursBilled === "number" ? params.hoursBilled : "Not specified"}`,
    aiEmailSummary.openingSummary ? `Reviewed summary: ${aiEmailSummary.openingSummary}` : null,
    "Findings summary:",
    findingsText,
    params.pdfAttachment ? `Attached PDF: ${params.pdfAttachment.filename}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [params.toEmail],
      subject,
      html,
      text,
      ...(params.pdfAttachment
        ? {
            attachments: [
              {
                filename: params.pdfAttachment.filename,
                content: params.pdfAttachment.contentBase64,
              },
            ],
          }
        : {}),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    return {
      sent: false,
      status: "failed" as const,
      warning:
        errorText.trim() ||
        "Audit report email was not sent because the email provider rejected the outgoing message.",
    };
  }

  const payload = (await response.json().catch(() => null)) as { id?: string } | null;
  return {
    sent: true,
    status: "sent" as const,
    providerMessageId: payload?.id ?? null,
  };
}
