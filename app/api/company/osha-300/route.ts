import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { buildOsha300Entry } from "@/lib/osha300";

export const runtime = "nodejs";

// GET /api/company/osha-300?year=2026
// Returns all incidents for the given calendar year, with OSHA 300 field mapping.
// Defaults to current year. Returns both recordable and non-recordable so the UI
// can show the full log with classification status.
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
  const recordableOnly = url.searchParams.get("recordableOnly") !== "false";
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
  const PAGE_SIZE = 100;

  if (!Number.isFinite(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "Invalid year." }, { status: 400 });
  }

  const yearStart = `${year}-01-01T00:00:00.000Z`;
  const yearEnd = `${year + 1}-01-01T00:00:00.000Z`;

  const rangeFrom = (page - 1) * PAGE_SIZE;
  const rangeTo = rangeFrom + PAGE_SIZE - 1;

  // Build both queries, then fire in parallel
  let countQuery = auth.supabase
    .from("company_incidents")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyScope.companyId)
    .gte("occurred_at", yearStart)
    .lt("occurred_at", yearEnd);
  if (recordableOnly) countQuery = countQuery.eq("recordable", true);

  let dataQuery = auth.supabase
    .from("company_incidents")
    .select(`
      id, title, description, category, severity,
      occurred_at, status,
      recordable, lost_time, fatality,
      days_away_from_work, days_restricted, job_transfer,
      body_part, injury_type, exposure_event_type,
      osha_description, osha_case_number,
      osha_employee_name, osha_job_title, osha_autofilled_at,
      jobsite:jobsite_id ( name ),
      reporter:created_by ( raw_user_meta_data )
    `)
    .eq("company_id", companyScope.companyId)
    .gte("occurred_at", yearStart)
    .lt("occurred_at", yearEnd)
    .order("occurred_at", { ascending: true })
    .range(rangeFrom, rangeTo);
  if (recordableOnly) dataQuery = dataQuery.eq("recordable", true);

  const [{ count: totalCount }, { data, error }] = await Promise.all([
    countQuery,
    dataQuery,
  ]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as Array<Record<string, unknown>>;

  function resolveDisplayName(userRecord: unknown): string | null {
    if (!userRecord || typeof userRecord !== "object") return null;
    const meta = (userRecord as Record<string, unknown>).raw_user_meta_data;
    if (!meta || typeof meta !== "object") return null;
    const m = meta as Record<string, unknown>;
    return (
      (typeof m.full_name === "string" ? m.full_name : null) ||
      (typeof m.name === "string" ? m.name : null) ||
      null
    );
  }

  const entries = rows.map((row) => {
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

  // Summary counts for the page header
  const totalRecordable = entries.filter((e) => e.recordable).length;
  const totalFatalities = entries.filter((e) => e.death).length;
  const totalDaysAway = entries.filter((e) => e.daysAway).length;
  const totalDaysAwayCount = entries.reduce((sum, e) => sum + e.daysAwayCount, 0);
  const totalDaysRestrictedCount = entries.reduce((sum, e) => sum + e.daysRestrictedCount, 0);
  const unclassifiedCount = rows.filter(
    (r) => !r.recordable && !r.osha_autofilled_at
  ).length;

  const total = totalCount ?? rows.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return NextResponse.json({
    year,
    entries,
    summary: {
      totalRecordable,
      totalFatalities,
      totalDaysAway,
      totalDaysAwayCount,
      totalDaysRestrictedCount,
      unclassifiedCount,
    },
    pagination: {
      page,
      pageSize: PAGE_SIZE,
      totalCount: total,
      totalPages,
      hasMore: page < totalPages,
    },
    rawCount: rows.length,
  });
}
