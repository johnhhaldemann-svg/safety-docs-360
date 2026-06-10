import {
  createAuditPdfWriter,
  finalizeAuditPdf,
  addAuditPdfPage,
  drawAuditPdfCover,
  drawAuditPdfSectionTitle,
  drawAuditPdfText,
  drawAuditPdfKeyValue,
  drawAuditPdfMetrics,
  cleanAuditPdfText,
  sanitizeAuditPdfFilePart,
  type AuditPdfWriter,
} from "@/lib/auditReports/csepStylePdf";
import { getMethodLabel, getStepLabel, type RcaMethod, type RcaStepKey } from "@/lib/rcaAi";
import { rgb } from "pdf-lib";

export type RcaReportSession = {
  id: string;
  rca_method: RcaMethod;
  status: string;
  current_step: RcaStepKey;
  summary: string | null;
  root_cause_confirmed: string | null;
  hse_notified_at: string | null;
  approved_by_name: string | null;
  approved_at: string | null;
  created_by_name: string | null;
  created_at: string;
};

export type RcaReportAction = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  severity: string;
  status: string;
  jobsite_name: string | null;
  company_name: string | null;
};

export type RcaReportMessage = {
  role: "user" | "assistant";
  content: string;
  step_key: string | null;
  created_at: string;
};

export type RcaReportFinding = {
  finding_type: string;
  category: string | null;
  description: string;
  why_level: number | null;
  sort_order: number;
};

export type RcaReportCapaItem = {
  title: string;
  description: string | null;
  priority: string;
  status: string;
  assigned_to_name: string | null;
  due_at: string | null;
  completed_at: string | null;
};

function clean(value: unknown, fallback = "Not specified") {
  return cleanAuditPdfText(value, fallback);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not recorded";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "Not recorded"
    : d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, " ");
}

function drawCapaRow(
  writer: AuditPdfWriter,
  item: RcaReportCapaItem,
  index: number
) {
  const MARGIN = 48;
  const CONTENT_WIDTH = 516;
  const colors = {
    ink: rgb(0.12, 0.12, 0.12),
    muted: rgb(0.36, 0.42, 0.5),
    navy: rgb(0.09, 0.21, 0.36),
    green: rgb(0.04, 0.42, 0.25),
    amber: rgb(0.68, 0.41, 0.03),
    red: rgb(0.74, 0.12, 0.12),
    border: rgb(0.76, 0.81, 0.88),
    paleBlue: rgb(0.94, 0.97, 1),
    white: rgb(1, 1, 1),
  };

  const priorityColor =
    item.priority === "critical" || item.priority === "high"
      ? colors.red
      : item.priority === "medium"
        ? colors.amber
        : colors.muted;

  const statusColor = item.status === "completed" ? colors.green : colors.muted;

  // Ensure space
  if (writer.y - 68 < MARGIN) addAuditPdfPage(writer);

  const top = writer.y;
  const rowBg = index % 2 === 0 ? colors.paleBlue : colors.white;

  writer.page.drawRectangle({
    x: MARGIN,
    y: top - 58,
    width: CONTENT_WIDTH,
    height: 64,
    borderWidth: 0.5,
    borderColor: colors.border,
    color: rowBg,
  });

  // Priority pill
  writer.page.drawText(`[${item.priority.toUpperCase()}]`, {
    x: MARGIN + 10,
    y: top - 16,
    size: 7,
    font: writer.bold,
    color: priorityColor,
  });

  // Title
  writer.page.drawText(item.title.slice(0, 80), {
    x: MARGIN + 70,
    y: top - 16,
    size: 9,
    font: writer.bold,
    color: colors.navy,
  });

  // Status
  writer.page.drawText(item.status.replace(/_/g, " ").toUpperCase(), {
    x: MARGIN + CONTENT_WIDTH - 100,
    y: top - 16,
    size: 7,
    font: writer.bold,
    color: statusColor,
  });

  // Description
  if (item.description) {
    writer.page.drawText(item.description.slice(0, 120), {
      x: MARGIN + 10,
      y: top - 30,
      size: 8,
      font: writer.regular,
      color: colors.ink,
    });
  }

  // Meta row
  const meta = [
    item.assigned_to_name ? `Owner: ${item.assigned_to_name}` : "Unassigned",
    item.due_at ? `Due: ${formatDate(item.due_at)}` : "No due date",
    item.completed_at ? `Completed: ${formatDate(item.completed_at)}` : null,
  ]
    .filter(Boolean)
    .join("   ·   ");

  writer.page.drawText(meta, {
    x: MARGIN + 10,
    y: top - 46,
    size: 7,
    font: writer.regular,
    color: colors.muted,
  });

  writer.y = top - 66;
}

export async function generateRcaReportPdf(params: {
  session: RcaReportSession;
  action: RcaReportAction;
  messages: RcaReportMessage[];
  findings: RcaReportFinding[];
  capaItems: RcaReportCapaItem[];
}): Promise<{ bytes: Uint8Array; filename: string }> {
  const { session, action, messages, findings, capaItems } = params;

  const writer = await createAuditPdfWriter();
  const companyLabel = clean(action.company_name, "Company");
  const siteLabel = clean(action.jobsite_name, "General Workspace");

  // ── Cover ──
  drawAuditPdfCover({
    writer,
    title: "Root Cause Analysis Report",
    subtitle: clean(action.title),
    companyName: companyLabel,
    jobsiteName: siteLabel,
    reportStatus: session.status === "approved" ? "approved" : "preview",
    metadata: [
      { label: "Category", value: capitalize(action.category) },
      { label: "Severity", value: capitalize(action.severity) },
      { label: "RCA Method", value: getMethodLabel(session.rca_method) },
      { label: "Initiated", value: formatDate(session.created_at) },
      { label: "Initiated by", value: clean(session.created_by_name) },
      { label: "HSE Notified", value: session.hse_notified_at ? formatDate(session.hse_notified_at) : "Not yet notified" },
      { label: "Approved by", value: clean(session.approved_by_name) },
      { label: "Approved", value: session.approved_at ? formatDate(session.approved_at) : "Pending sign-off" },
    ],
  });

  // ── Summary metrics ──
  const rootCauses = findings.filter((f) => f.finding_type === "root_cause");
  const capaOpen = capaItems.filter((c) => c.status === "open" || c.status === "in_progress").length;
  const capaComplete = capaItems.filter((c) => c.status === "completed").length;

  drawAuditPdfMetrics(writer, [
    { label: "Root Causes", value: String(rootCauses.length || "TBC") },
    { label: "Contributing Factors", value: String(findings.filter((f) => f.finding_type === "contributing_factor").length) },
    { label: "CAPA Items", value: String(capaItems.length) },
    { label: "CAPA Open", value: String(capaOpen) },
    { label: "CAPA Complete", value: String(capaComplete) },
  ]);
  writer.y -= 8;

  // ── Corrective Action Summary ──
  drawAuditPdfSectionTitle(writer, "Corrective Action Details");
  drawAuditPdfKeyValue(writer, "Title", clean(action.title));
  drawAuditPdfKeyValue(writer, "Category", capitalize(action.category));
  drawAuditPdfKeyValue(writer, "Severity", capitalize(action.severity));
  drawAuditPdfKeyValue(writer, "Status", capitalize(action.status));
  if (action.description) {
    writer.y -= 6;
    drawAuditPdfText(writer, action.description, { size: 9, color: rgb(0.12, 0.12, 0.12) });
  }
  writer.y -= 12;

  // ── Root Cause Confirmed ──
  if (session.root_cause_confirmed) {
    drawAuditPdfSectionTitle(writer, "Confirmed Root Cause");
    drawAuditPdfText(writer, session.root_cause_confirmed, {
      size: 10,
      font: writer.bold,
      color: rgb(0.09, 0.21, 0.36),
    });
    writer.y -= 8;
  }

  // ── AI Summary ──
  if (session.summary) {
    drawAuditPdfSectionTitle(writer, "Investigation Summary");
    drawAuditPdfText(writer, session.summary, { size: 9 });
    writer.y -= 8;
  }

  // ── Findings ──
  if (findings.length > 0) {
    drawAuditPdfSectionTitle(writer, "Root Cause Analysis Findings");

    const grouped: Record<string, RcaReportFinding[]> = {};
    for (const f of findings) {
      const key = f.finding_type;
      grouped[key] = [...(grouped[key] ?? []), f];
    }

    const ORDER: RcaReportFinding["finding_type"][] = [
      "immediate_cause",
      "contributing_factor",
      "root_cause",
      "systemic_factor",
    ];

    for (const type of ORDER) {
      const group = grouped[type];
      if (!group?.length) continue;

      const label =
        type === "immediate_cause"
          ? "Immediate Cause"
          : type === "contributing_factor"
            ? "Contributing Factors"
            : type === "root_cause"
              ? "Root Causes"
              : "Systemic Factors";

      const tone =
        type === "root_cause"
          ? "critical"
          : type === "systemic_factor"
            ? "warning"
            : "neutral";

      // Sub-header
      writer.y -= 4;
      drawAuditPdfText(writer, label.toUpperCase(), {
        size: 8,
        font: writer.bold,
        color: rgb(0.36, 0.42, 0.5),
      });
      writer.y -= 4;

      for (const finding of group) {
        const whyLabel = finding.why_level ? ` (Why ${finding.why_level})` : "";
        const categoryLabel = finding.category ? ` — ${capitalize(finding.category)}` : "";
        // Use drawAuditPdfFinding-style box but simpler
        const titleText = `${label.replace(/s$/, "")}${whyLabel}${categoryLabel}`;
        const colors = {
          critical: { fill: rgb(1, 0.91, 0.88), text: rgb(0.74, 0.12, 0.12) },
          warning: { fill: rgb(1, 0.97, 0.88), text: rgb(0.68, 0.41, 0.03) },
          neutral: { fill: rgb(0.94, 0.97, 1), text: rgb(0.09, 0.21, 0.36) },
        }[tone];

        const MARGIN = 48;
        const CONTENT_WIDTH = 516;
        if (writer.y - 60 < MARGIN) addAuditPdfPage(writer);
        const top = writer.y;
        writer.page.drawRectangle({
          x: MARGIN,
          y: top - 56,
          width: CONTENT_WIDTH,
          height: 62,
          borderWidth: 1,
          borderColor: rgb(0.76, 0.81, 0.88),
          color: colors.fill,
        });
        writer.page.drawText(titleText, {
          x: MARGIN + 10,
          y: top - 16,
          size: 8,
          font: writer.bold,
          color: colors.text,
        });
        // Description wrapped
        const descLines = finding.description
          .replace(/\s+/g, " ")
          .trim()
          .match(/.{1,90}(\s|$)/g) ?? [finding.description];
        descLines.slice(0, 3).forEach((line, i) => {
          writer.page.drawText(line.trim(), {
            x: MARGIN + 10,
            y: top - 30 - i * 11,
            size: 9,
            font: writer.regular,
            color: rgb(0.12, 0.12, 0.12),
          });
        });
        writer.y = top - 68;
      }
      writer.y -= 4;
    }
  }

  // ── CAPA Items ──
  if (capaItems.length > 0) {
    addAuditPdfPage(writer);
    drawAuditPdfSectionTitle(writer, "Corrective & Preventive Actions (CAPA)");
    writer.y -= 4;

    capaItems.forEach((item, idx) => drawCapaRow(writer, item, idx));
    writer.y -= 8;
  }

  // ── Investigation Transcript (condensed) ──
  const userMessages = messages.filter((m) => m.role === "user");
  if (userMessages.length > 0) {
    addAuditPdfPage(writer);
    drawAuditPdfSectionTitle(writer, "Investigation Transcript");
    drawAuditPdfText(writer, "The following captures the responses provided during the AI-guided RCA session.", {
      size: 8,
      color: rgb(0.36, 0.42, 0.5),
    });
    writer.y -= 8;

    let lastStep = "";
    for (const msg of messages) {
      if (!msg.step_key || msg.role !== "user") continue;
      if (msg.step_key !== lastStep) {
        writer.y -= 4;
        drawAuditPdfText(writer, getStepLabel(msg.step_key as RcaStepKey).toUpperCase(), {
          size: 8,
          font: writer.bold,
          color: rgb(0.36, 0.42, 0.5),
        });
        lastStep = msg.step_key;
      }
      drawAuditPdfText(writer, msg.content, { size: 9 });
      writer.y -= 4;
    }
  }

  // ── Sign-off block ──
  if (writer.y - 120 < 48) addAuditPdfPage(writer);
  writer.y -= 16;
  drawAuditPdfSectionTitle(writer, "Approval & Sign-off");

  const MARGIN = 48;
  const CONTENT_WIDTH = 516;
  const boxTop = writer.y;
  writer.page.drawRectangle({
    x: MARGIN,
    y: boxTop - 90,
    width: CONTENT_WIDTH,
    height: 96,
    borderWidth: 1,
    borderColor: rgb(0.76, 0.81, 0.88),
    color: rgb(0.94, 0.97, 1),
  });

  writer.y -= 12;
  drawAuditPdfKeyValue(writer, "Approved by", clean(session.approved_by_name, "Pending"));
  drawAuditPdfKeyValue(writer, "Approval date", session.approved_at ? formatDate(session.approved_at) : "Pending");
  drawAuditPdfKeyValue(writer, "Report status", session.status === "approved" ? "Approved — final" : "Pending HSE sign-off");
  writer.y -= 8;
  drawAuditPdfText(writer, "This Root Cause Analysis was conducted using the SafetyDocs360 AI-guided RCA system. The investigation record is stored as a controlled safety document.", {
    size: 8,
    color: rgb(0.36, 0.42, 0.5),
  });

  const bytes = await finalizeAuditPdf(writer);
  const safeTitle = sanitizeAuditPdfFilePart(action.title);
  const dateStr = new Date(session.created_at).toISOString().slice(0, 10);
  const filename = `rca-report-${safeTitle}-${dateStr}.pdf`;

  return { bytes, filename };
}
