import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { buildOsha300Entry } from "@/lib/osha300";
import {
  createAuditPdfWriter,
  finalizeAuditPdf,
  addAuditPdfPage,
  drawAuditPdfCover,
  drawAuditPdfSectionTitle,
  drawAuditPdfText,
  sanitizeAuditPdfFilePart,
} from "@/lib/auditReports/csepStylePdf";
import { rgb } from "pdf-lib";

export const runtime = "nodejs";
export const maxDuration = 60;

// GET /api/company/osha-300/export-300a-pdf?year=2026
// Generates the OSHA 300A Annual Summary of Work-Related Injuries and Illnesses.
// The 300A is a roll-up of the 300 log that must be posted Feb 1–Apr 30
// and submitted to OSHA upon request. (29 CFR § 1904.32)
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
  if (!Number.isFinite(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "Invalid year." }, { status: 400 });
  }

  const yearStart = `${year}-01-01T00:00:00.000Z`;
  const yearEnd = `${year + 1}-01-01T00:00:00.000Z`;

  // Load company info
  const { data: companyData } = await auth.supabase
    .from("companies")
    .select("name, address, city, state, zip, naics_code, industry_description")
    .eq("id", companyScope.companyId)
    .maybeSingle();
  const company = companyData as Record<string, string | null> | null;
  const companyName = company?.name ?? "Company";

  // Load all recordable incidents for the year
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
    .limit(500);

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

  // ── 300A Totals ──────────────────────────────────────────────────────────────
  const totalDeaths        = entries.filter((e) => e.death).length;
  const totalDaysAwayCases = entries.filter((e) => e.daysAway).length;
  const totalRestrictedCases = entries.filter((e) => e.restricted).length;
  const totalOtherRecordable = entries.filter((e) => e.otherRecordable).length;
  const totalDaysAway      = entries.reduce((s, e) => s + e.daysAwayCount, 0);
  const totalDaysRestricted = entries.reduce((s, e) => s + e.daysRestrictedCount, 0);

  // Illness type breakdown (Column M)
  const m1Injury     = entries.filter((e) => e.illnessType === "injury").length;
  const m2Skin       = entries.filter((e) => e.illnessType === "skin_disorder").length;
  const m3Resp       = entries.filter((e) => e.illnessType === "respiratory").length;
  const m4Poison     = entries.filter((e) => e.illnessType === "poisoning").length;
  const m5Hearing    = entries.filter((e) => e.illnessType === "hearing_loss").length;
  const m6Other      = entries.filter((e) => e.illnessType === "other_illness").length;

  // ── Build PDF ──────────────────────────────────────────────────────────────
  const writer = await createAuditPdfWriter();
  const MARGIN = 48;
  const CONTENT_WIDTH = 516;

  const colors = {
    ink:      rgb(0.12, 0.12, 0.12),
    muted:    rgb(0.36, 0.42, 0.5),
    navy:     rgb(0.09, 0.21, 0.36),
    border:   rgb(0.76, 0.81, 0.88),
    paleBlue: rgb(0.94, 0.97, 1),
    white:    rgb(1, 1, 1),
    rose:     rgb(0.74, 0.12, 0.12),
    amber:    rgb(0.68, 0.41, 0.03),
    green:    rgb(0.05, 0.43, 0.26),
  };

  drawAuditPdfCover({
    writer,
    title: "OSHA 300A Annual Summary",
    subtitle: `Summary of Work-Related Injuries and Illnesses — ${year}`,
    companyName,
    jobsiteName: "All Establishments",
    reportStatus: "approved",
    metadata: [
      { label: "Regulation", value: "29 CFR Part 1904.32" },
      { label: "Calendar year", value: String(year) },
      { label: "Total recordable cases", value: String(entries.length) },
      { label: "Generated", value: new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) },
    ],
  });

  // ── Regulatory notice ──
  drawAuditPdfText(writer,
    "Post this Summary in a visible location from February 1 through April 30 of the year following the calendar year covered. " +
    "OSHA Form 300A — 29 CFR Part 1904.32(b). All establishments covered by Part 1904 must complete this Summary.",
    { size: 8, color: colors.muted }
  );
  writer.y -= 16;

  // ── Establishment Information ──────────────────────────────────────────────
  drawAuditPdfSectionTitle(writer, "Establishment Information");

  function drawField(label: string, value: string | null, yOffset = 0) {
    const y = writer.y - yOffset;
    if (y - 18 < MARGIN) addAuditPdfPage(writer);
    writer.page.drawText(label, {
      x: MARGIN, y: writer.y, size: 7, font: writer.regular, color: colors.muted,
    });
    writer.page.drawText(value ?? "___________________________", {
      x: MARGIN + 160, y: writer.y, size: 8,
      font: value ? writer.bold : writer.regular,
      color: value ? colors.ink : colors.border,
    });
    writer.y -= 16;
  }

  drawField("Establishment name", companyName);
  drawField("Street address", company?.address ?? null);
  drawField("City, State, ZIP", [company?.city, company?.state, company?.zip].filter(Boolean).join(", ") || null);
  drawField("Industry description", company?.industry_description ?? null);
  drawField("Standard Industrial Classification (SIC) / NAICS", company?.naics_code ?? null);
  writer.y -= 8;

  // ── Employment Information ─────────────────────────────────────────────────
  drawAuditPdfSectionTitle(writer, "Employment Information  (complete manually before posting)");

  drawField("Annual average number of employees", null);
  drawField("Total hours worked by all employees last year", null);
  writer.y -= 8;

  // ── Part I: Number of Cases ────────────────────────────────────────────────
  drawAuditPdfSectionTitle(writer, "Part I — Number of Cases");

  type CaseRow = { col: string; label: string; value: number; color?: ReturnType<typeof rgb> };
  const caseRows: CaseRow[] = [
    { col: "G", label: "Total number of deaths", value: totalDeaths, color: totalDeaths > 0 ? colors.rose : undefined },
    { col: "H", label: "Total number of cases with days away from work", value: totalDaysAwayCases },
    { col: "I", label: "Total number of cases with job transfer or restriction", value: totalRestrictedCases },
    { col: "J", label: "Total number of other recordable cases", value: totalOtherRecordable },
  ];

  for (const row of caseRows) {
    if (writer.y - 24 < MARGIN) addAuditPdfPage(writer);
    writer.page.drawRectangle({
      x: MARGIN, y: writer.y - 18, width: CONTENT_WIDTH, height: 22,
      color: colors.paleBlue, borderColor: colors.border, borderWidth: 0.4,
    });
    writer.page.drawText(`(${row.col})`, {
      x: MARGIN + 6, y: writer.y - 12, size: 8, font: writer.bold,
      color: colors.navy,
    });
    writer.page.drawText(row.label, {
      x: MARGIN + 30, y: writer.y - 12, size: 8, font: writer.regular, color: colors.ink,
    });
    writer.page.drawText(String(row.value), {
      x: MARGIN + CONTENT_WIDTH - 30, y: writer.y - 12, size: 10, font: writer.bold,
      color: row.color ?? (row.value > 0 ? colors.amber : colors.green),
    });
    writer.y -= 26;
  }
  writer.y -= 8;

  // ── Part II: Number of Days ────────────────────────────────────────────────
  drawAuditPdfSectionTitle(writer, "Part II — Number of Days");

  const dayRows: CaseRow[] = [
    { col: "K", label: "Total number of days away from work", value: totalDaysAway },
    { col: "L", label: "Total number of days of job transfer or restriction", value: totalDaysRestricted },
  ];

  for (const row of dayRows) {
    if (writer.y - 24 < MARGIN) addAuditPdfPage(writer);
    writer.page.drawRectangle({
      x: MARGIN, y: writer.y - 18, width: CONTENT_WIDTH, height: 22,
      color: colors.paleBlue, borderColor: colors.border, borderWidth: 0.4,
    });
    writer.page.drawText(`(${row.col})`, {
      x: MARGIN + 6, y: writer.y - 12, size: 8, font: writer.bold, color: colors.navy,
    });
    writer.page.drawText(row.label, {
      x: MARGIN + 30, y: writer.y - 12, size: 8, font: writer.regular, color: colors.ink,
    });
    writer.page.drawText(String(row.value), {
      x: MARGIN + CONTENT_WIDTH - 30, y: writer.y - 12, size: 10, font: writer.bold,
      color: row.value > 0 ? colors.amber : colors.green,
    });
    writer.y -= 26;
  }
  writer.y -= 8;

  // ── Part III: Injury and Illness Types ────────────────────────────────────
  drawAuditPdfSectionTitle(writer, "Part III — Injury and Illness Types (Column M)");

  const illnessRows: Array<{ col: string; label: string; value: number }> = [
    { col: "M1", label: "Injuries", value: m1Injury },
    { col: "M2", label: "Skin disorders", value: m2Skin },
    { col: "M3", label: "Respiratory conditions", value: m3Resp },
    { col: "M4", label: "Poisonings", value: m4Poison },
    { col: "M5", label: "Hearing loss", value: m5Hearing },
    { col: "M6", label: "All other illnesses", value: m6Other },
  ];

  const colW = Math.floor(CONTENT_WIDTH / 3);
  let colX = MARGIN;
  let rowCount = 0;
  const rowY = writer.y;

  for (const row of illnessRows) {
    if (rowCount > 0 && rowCount % 3 === 0) {
      colX = MARGIN;
      writer.y -= 30;
    }
    const y = rowCount < 3 ? rowY : rowY - 30;
    writer.page.drawRectangle({
      x: colX, y: y - 24, width: colW - 4, height: 28,
      color: colors.paleBlue, borderColor: colors.border, borderWidth: 0.4,
    });
    writer.page.drawText(`(${row.col}) ${row.label}`, {
      x: colX + 6, y: y - 10, size: 7, font: writer.regular, color: colors.muted,
    });
    writer.page.drawText(String(row.value), {
      x: colX + 6, y: y - 20, size: 11, font: writer.bold,
      color: row.value > 0 ? colors.amber : colors.green,
    });
    colX += colW;
    rowCount++;
  }
  writer.y = rowY - 60;

  // Total row
  if (writer.y - 30 < MARGIN) addAuditPdfPage(writer);
  writer.y -= 8;
  writer.page.drawRectangle({
    x: MARGIN, y: writer.y - 18, width: CONTENT_WIDTH, height: 22,
    color: colors.navy, borderColor: colors.border, borderWidth: 0,
  });
  writer.page.drawText("Total recordable cases (sum of all columns)", {
    x: MARGIN + 8, y: writer.y - 12, size: 8, font: writer.bold, color: colors.white,
  });
  writer.page.drawText(String(entries.length), {
    x: MARGIN + CONTENT_WIDTH - 30, y: writer.y - 12, size: 10, font: writer.bold, color: colors.white,
  });
  writer.y -= 32;

  // ── Certification block ────────────────────────────────────────────────────
  if (writer.y - 120 < MARGIN) addAuditPdfPage(writer);
  writer.y -= 8;
  drawAuditPdfSectionTitle(writer, "Certification — Company Executive");

  drawAuditPdfText(writer,
    "I certify that I have examined this document and that to the best of my knowledge the entries are true, " +
    "accurate, and complete, and that the annual average number of employees and total hours worked are also true and complete.",
    { size: 8, color: colors.ink }
  );
  writer.y -= 20;

  // Signature lines
  const sigFields = [
    { label: "Company Executive Signature", width: 220 },
    { label: "Title", width: 130 },
    { label: "Phone", width: 120 },
  ];
  let sigX = MARGIN;
  for (const f of sigFields) {
    writer.page.drawLine({
      start: { x: sigX, y: writer.y },
      end:   { x: sigX + f.width - 8, y: writer.y },
      thickness: 0.5, color: colors.border,
    });
    writer.page.drawText(f.label, {
      x: sigX, y: writer.y - 10, size: 7, font: writer.regular, color: colors.muted,
    });
    sigX += f.width;
  }
  writer.y -= 28;

  // Date line
  writer.page.drawLine({
    start: { x: MARGIN, y: writer.y },
    end:   { x: MARGIN + 160, y: writer.y },
    thickness: 0.5, color: colors.border,
  });
  writer.page.drawText("Date", {
    x: MARGIN, y: writer.y - 10, size: 7, font: writer.regular, color: colors.muted,
  });

  const bytes = await finalizeAuditPdf(writer);
  const safeName = sanitizeAuditPdfFilePart(companyName);
  const filename = `osha-300a-summary-${safeName}-${year}.pdf`;

  return new Response(bytes, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
