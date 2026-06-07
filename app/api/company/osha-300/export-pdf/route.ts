import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { buildOsha300Entry, ILLNESS_TYPE_LABELS } from "@/lib/osha300";
import {
  createAuditPdfWriter,
  finalizeAuditPdf,
  addAuditPdfPage,
  drawAuditPdfCover,
  drawAuditPdfSectionTitle,
  drawAuditPdfMetrics,
  drawAuditPdfText,
  sanitizeAuditPdfFilePart,
} from "@/lib/auditReports/csepStylePdf";
import { rgb } from "pdf-lib";

export const runtime = "nodejs";
export const maxDuration = 60;

// GET /api/company/osha-300/export-pdf?year=2026
export async function GET(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_view_dashboards", "can_access_field_work"],
  });
  if ("error" in auth) return auth.error;

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) {
    return NextResponse.json({ error: "Not linked to a company workspace." }, { status: 400 });
  }

  const url = new URL(request.url);
  const year = parseInt(url.searchParams.get("year") ?? String(new Date().getFullYear()), 10);

  const yearStart = `${year}-01-01T00:00:00.000Z`;
  const yearEnd = `${year + 1}-01-01T00:00:00.000Z`;

  // Load company name
  const { data: companyData } = await auth.supabase
    .from("companies")
    .select("name")
    .eq("id", companyScope.companyId)
    .maybeSingle();
  const companyName = (companyData as { name?: string } | null)?.name ?? "Company";

  // Load recordable incidents
  const { data: rows } = await auth.supabase
    .from("company_incidents")
    .select(`
      id, title, description, category, severity,
      occurred_at,
      recordable, lost_time, fatality,
      days_away_from_work, days_restricted, job_transfer,
      body_part, injury_type,
      osha_description, osha_case_number, osha_employee_name, osha_job_title,
      jobsite:jobsite_id ( name ),
      reporter:created_by ( raw_user_meta_data )
    `)
    .eq("company_id", companyScope.companyId)
    .eq("recordable", true)
    .gte("occurred_at", yearStart)
    .lt("occurred_at", yearEnd)
    .order("occurred_at", { ascending: true })
    .limit(300);

  function resolveDisplayName(userRecord: unknown): string | null {
    if (!userRecord || typeof userRecord !== "object") return null;
    const meta = (userRecord as Record<string, unknown>).raw_user_meta_data;
    if (!meta || typeof meta !== "object") return null;
    const m = meta as Record<string, unknown>;
    return (typeof m.full_name === "string" ? m.full_name : null) ||
           (typeof m.name === "string" ? m.name : null) || null;
  }

  const incidents = (rows ?? []) as Array<Record<string, unknown>>;
  const entries = incidents.map((row) => {
    const jobsite = Array.isArray(row.jobsite) ? row.jobsite[0] : row.jobsite;
    const reporter = Array.isArray(row.reporter) ? row.reporter[0] : row.reporter;
    return buildOsha300Entry({
      id: String(row.id ?? ""),
      title: String(row.title ?? ""),
      description: row.description ? String(row.description) : null,
      category: row.category ? String(row.category) : null,
      severity: String(row.severity ?? "low"),
      occurred_at: row.occurred_at ? String(row.occurred_at) : null,
      recordable: Boolean(row.recordable),
      lost_time: Boolean(row.lost_time),
      fatality: Boolean(row.fatality),
      days_away_from_work: Number(row.days_away_from_work) || 0,
      days_restricted: Number(row.days_restricted) || 0,
      job_transfer: Boolean(row.job_transfer),
      body_part: row.body_part ? String(row.body_part) : null,
      injury_type: row.injury_type ? String(row.injury_type) : null,
      osha_description: row.osha_description ? String(row.osha_description) : null,
      employee_name: row.osha_employee_name ? String(row.osha_employee_name) : resolveDisplayName(reporter),
      job_title: row.osha_job_title ? String(row.osha_job_title) : null,
      jobsite_name: (jobsite as { name?: string } | null)?.name ?? null,
      case_number: row.osha_case_number ? String(row.osha_case_number) : null,
    });
  });

  // ── Build PDF ──
  const writer = await createAuditPdfWriter();
  const MARGIN = 48;
  const CONTENT_WIDTH = 516;
  const colors = {
    ink: rgb(0.12, 0.12, 0.12),
    muted: rgb(0.36, 0.42, 0.5),
    navy: rgb(0.09, 0.21, 0.36),
    border: rgb(0.76, 0.81, 0.88),
    paleBlue: rgb(0.94, 0.97, 1),
    white: rgb(1, 1, 1),
    rose: rgb(0.74, 0.12, 0.12),
    amber: rgb(0.68, 0.41, 0.03),
  };

  drawAuditPdfCover({
    writer,
    title: "OSHA 300 Log",
    subtitle: `Log of Work-Related Injuries and Illnesses — ${year}`,
    companyName,
    reportStatus: "approved",
    metadata: [
      { label: "Regulation", value: "29 CFR Part 1904" },
      { label: "Log year", value: String(year) },
      { label: "Recordable cases", value: String(entries.length) },
      { label: "Generated", value: new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) },
    ],
  });

  // Summary metrics
  const totalDaysAway = entries.reduce((s, e) => s + e.daysAwayCount, 0);
  const totalDaysRestricted = entries.reduce((s, e) => s + e.daysRestrictedCount, 0);
  drawAuditPdfMetrics(writer, [
    { label: "Total recordable", value: String(entries.length) },
    { label: "Fatalities (G)", value: String(entries.filter((e) => e.death).length) },
    { label: "Days away (H)", value: String(entries.filter((e) => e.daysAway).length) },
    { label: "Total days away (K)", value: String(totalDaysAway) },
    { label: "Total days restricted (L)", value: String(totalDaysRestricted) },
  ]);
  writer.y -= 12;

  // Log entries
  drawAuditPdfSectionTitle(writer, "OSHA 300 Log Entries");

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (writer.y - 80 < MARGIN) addAuditPdfPage(writer);

    const top = writer.y;
    const rowBg = i % 2 === 0 ? colors.paleBlue : colors.white;

    writer.page.drawRectangle({
      x: MARGIN,
      y: top - 72,
      width: CONTENT_WIDTH,
      height: 78,
      borderWidth: 0.5,
      borderColor: colors.border,
      color: rowBg,
    });

    // Row header: case number + date + classification
    writer.page.drawText(entry.caseNumber, {
      x: MARGIN + 8,
      y: top - 14,
      size: 8,
      font: writer.bold,
      color: colors.navy,
    });

    const dateStr = entry.dateOfInjury
      ? new Date(entry.dateOfInjury).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      : "Date unknown";

    writer.page.drawText(dateStr, {
      x: MARGIN + 70,
      y: top - 14,
      size: 8,
      font: writer.regular,
      color: colors.muted,
    });

    // Classification tag
    const classLabel = entry.death ? "Death (G)"
      : entry.daysAway ? "Days away (H)"
      : entry.restricted ? "Restricted (I)"
      : "Other recordable (J)";

    const classColor = entry.death || entry.daysAway ? colors.rose : colors.amber;
    writer.page.drawText(classLabel, {
      x: MARGIN + 180,
      y: top - 14,
      size: 7,
      font: writer.bold,
      color: classColor,
    });

    // Days
    if (entry.daysAwayCount > 0) {
      writer.page.drawText(`${entry.daysAwayCount}d away`, {
        x: MARGIN + 310,
        y: top - 14,
        size: 7,
        font: writer.regular,
        color: colors.muted,
      });
    }
    if (entry.daysRestrictedCount > 0) {
      writer.page.drawText(`${entry.daysRestrictedCount}d restricted`, {
        x: MARGIN + 370,
        y: top - 14,
        size: 7,
        font: writer.regular,
        color: colors.muted,
      });
    }

    // Column M
    writer.page.drawText(ILLNESS_TYPE_LABELS[entry.illnessType], {
      x: MARGIN + CONTENT_WIDTH - 130,
      y: top - 14,
      size: 7,
      font: writer.regular,
      color: colors.muted,
    });

    // Employee name (B) + job title (C) + location (E)
    const personLine = [
      entry.employeeName ?? "Name not recorded",
      entry.jobTitle ? `(${entry.jobTitle})` : null,
      entry.whereOccurred ? `· ${entry.whereOccurred}` : null,
    ].filter(Boolean).join(" ");

    writer.page.drawText(personLine.slice(0, 95), {
      x: MARGIN + 8,
      y: top - 28,
      size: 8,
      font: writer.regular,
      color: colors.ink,
    });

    // Column F description
    const desc = (entry.descriptionOfInjury ?? entry.caseNumber).slice(0, 190);
    const descLines = desc.match(/.{1,90}(\s|$)/g) ?? [desc];
    descLines.slice(0, 2).forEach((line, li) => {
      writer.page.drawText(line.trim(), {
        x: MARGIN + 8,
        y: top - 42 - li * 11,
        size: 8,
        font: writer.regular,
        color: colors.ink,
      });
    });

    writer.y = top - 80;
  }

  // Certification / signature block
  if (writer.y - 120 < MARGIN) addAuditPdfPage(writer);
  writer.y -= 16;
  drawAuditPdfSectionTitle(writer, "Certification");
  drawAuditPdfText(writer,
    "I certify that I have examined this document and that to the best of my knowledge the entries are true, accurate, and complete.",
    { size: 9, color: colors.ink }
  );
  writer.y -= 24;
  writer.page.drawLine({
    start: { x: MARGIN, y: writer.y },
    end: { x: MARGIN + 200, y: writer.y },
    thickness: 0.5,
    color: colors.border,
  });
  writer.page.drawText("Company Executive Signature", {
    x: MARGIN, y: writer.y - 10, size: 7, font: writer.regular, color: colors.muted,
  });
  writer.page.drawLine({
    start: { x: MARGIN + 240, y: writer.y },
    end: { x: MARGIN + CONTENT_WIDTH, y: writer.y },
    thickness: 0.5,
    color: colors.border,
  });
  writer.page.drawText("Date", {
    x: MARGIN + 240, y: writer.y - 10, size: 7, font: writer.regular, color: colors.muted,
  });

  const bytes = await finalizeAuditPdf(writer);
  const safeName = sanitizeAuditPdfFilePart(companyName);
  const filename = `osha-300-log-${safeName}-${year}.pdf`;

  return new Response(bytes, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
