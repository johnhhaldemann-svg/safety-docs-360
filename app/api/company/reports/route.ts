import { NextResponse } from "next/server";
import { authorizeRequest, isAdminRole } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

function isMissingTable(message?: string | null) {
  return (message ?? "").toLowerCase().includes("company_reports");
}
function isMissingCompatView(message?: string | null) {
  return (message ?? "").toLowerCase().includes("compat_company_reports");
}
function canManage(role: string) {
  return isAdminRole(role) || role === "company_admin" || role === "manager" || role === "safety_manager";
}

type ScopeContext = {
  auth: Exclude<Awaited<ReturnType<typeof authorizeRequest>>, { error: NextResponse }>;
  companyId: string;
};

type EodReportPayload = {
  reportType: string;
  title: string;
  jobsiteId: string | null;
  workDate: string;
  narrative: string;
  metrics: Record<string, unknown>;
  markdown: string;
};

function formatDateLabel(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

async function buildEodReportPayload({
  auth,
  companyId,
  jobsiteId,
  workDate,
  requestedNarrative,
}: {
  auth: ScopeContext["auth"];
  companyId: string;
  jobsiteId: string | null;
  workDate: string;
  requestedNarrative: string | null;
}): Promise<EodReportPayload> {
  const dayStartIso = `${workDate}T00:00:00.000Z`;
  const dayEndIso = `${workDate}T23:59:59.999Z`;
  const [jobsiteRes, dapsRes, actionsRes, permitsRes, incidentsRes] = await Promise.all([
    jobsiteId
      ? auth.supabase.from("company_jobsites").select("id, name").eq("id", jobsiteId).eq("company_id", companyId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    auth.supabase
      .from("company_daps")
      .select("*")
      .eq("company_id", companyId)
      .gte("created_at", dayStartIso)
      .lte("created_at", dayEndIso)
      .limit(200),
    auth.supabase
      .from("company_corrective_actions")
      .select("id, title, category, status, severity, observation_type, sif_potential, created_at, closed_at, jobsite_id")
      .eq("company_id", companyId)
      .gte("created_at", dayStartIso)
      .lte("created_at", dayEndIso)
      .limit(500),
    auth.supabase
      .from("company_permits")
      .select("id, title, permit_type, status, jobsite_id, created_at")
      .eq("company_id", companyId)
      .gte("created_at", dayStartIso)
      .lte("created_at", dayEndIso)
      .limit(500),
    auth.supabase
      .from("company_incidents")
      .select("id, title, incident_type, category, status, severity, created_at, jobsite_id")
      .eq("company_id", companyId)
      .gte("created_at", dayStartIso)
      .lte("created_at", dayEndIso)
      .limit(500),
  ]);
  if (jobsiteRes && "error" in jobsiteRes && jobsiteRes.error) {
    throw new Error(jobsiteRes.error.message || "Failed to load jobsite.");
  }
  if (dapsRes.error) throw new Error(dapsRes.error.message || "Failed to load DAP data.");
  if (actionsRes.error) throw new Error(actionsRes.error.message || "Failed to load observation data.");
  if (permitsRes.error) throw new Error(permitsRes.error.message || "Failed to load permit data.");
  if (incidentsRes.error) throw new Error(incidentsRes.error.message || "Failed to load incident data.");

  const scopedDaps = (dapsRes.data ?? []).filter((row) => !jobsiteId || row.jobsite_id === jobsiteId);
  const scopedActions = (actionsRes.data ?? []).filter((row) => !jobsiteId || row.jobsite_id === jobsiteId);
  const scopedPermits = (permitsRes.data ?? []).filter((row) => !jobsiteId || row.jobsite_id === jobsiteId);
  const scopedIncidents = (incidentsRes.data ?? []).filter((row) => !jobsiteId || row.jobsite_id === jobsiteId);

  const openDeficiencies = scopedActions.filter((row) => row.status !== "verified_closed").length;
  const closedDeficiencies = scopedActions.filter((row) => row.status === "verified_closed").length;
  const positiveObservations = scopedActions.filter(
    (row) => String(row.observation_type ?? "").toLowerCase() === "positive"
  ).length;
  const highRiskObservations = scopedActions.filter((row) =>
    ["high", "critical"].includes(String(row.severity ?? "").toLowerCase())
  ).length;
  const sifCount = scopedActions.filter((row) => Boolean(row.sif_potential)).length;
  const permitCount = scopedPermits.length;
  const incidentCount = scopedIncidents.length;
  const nearMissCount = scopedIncidents.filter((row) =>
    String(row.incident_type ?? row.category ?? "").toLowerCase().includes("near")
  ).length;

  const dapPlannedWork = scopedDaps
    .map((dap) => String((dap as Record<string, unknown>).title ?? "").trim())
    .filter(Boolean);
  const weatherSamples = scopedDaps
    .map((dap) => String((dap as Record<string, unknown>).weather_summary ?? "").trim())
    .filter(Boolean);
  const weatherSummary = weatherSamples[0] ?? "No weather summary submitted.";

  const hazardMap = new Map<string, number>();
  for (const item of scopedActions) {
    const category = String(item.category ?? "uncategorized").toLowerCase();
    hazardMap.set(category, (hazardMap.get(category) ?? 0) + 1);
  }
  const topHazards = Array.from(hazardMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([category, count]) => ({ category, count }));

  const generatedNarrative =
    requestedNarrative?.trim() ||
    `Work completed for ${formatDateLabel(workDate)} includes ${dapPlannedWork.length} planned activity groups with ${scopedActions.length} field observations. ` +
      `${openDeficiencies} deficiencies remain open and ${closedDeficiencies} were closed. ` +
      `${permitCount} permits were used, and ${incidentCount} incidents (${nearMissCount} near misses) were logged. ` +
      `${highRiskObservations} high-risk observations and ${sifCount} SIF-potential findings were tracked.`;

  const jobsiteName = (jobsiteRes && "data" in jobsiteRes && jobsiteRes.data?.name) || "All Jobsites";
  const markdown = [
    `# End-of-Day Safety Report`,
    ``,
    `- Date: ${formatDateLabel(workDate)}`,
    `- Jobsite: ${jobsiteName}`,
    ``,
    `## DAP Planned Work`,
    dapPlannedWork.length > 0 ? dapPlannedWork.map((item) => `- ${item}`).join("\n") : "- No DAP planned work submitted.",
    ``,
    `## Field Observations`,
    `- Total observations: ${scopedActions.length}`,
    `- Positive observations: ${positiveObservations}`,
    `- High-risk observations: ${highRiskObservations}`,
    `- SIF count: ${sifCount}`,
    ``,
    `## Deficiencies`,
    `- Open deficiencies: ${openDeficiencies}`,
    `- Closed deficiencies: ${closedDeficiencies}`,
    ``,
    `## Permits Used`,
    `- Total permits used: ${permitCount}`,
    ``,
    `## Incidents / Near Misses`,
    `- Incidents: ${incidentCount}`,
    `- Near misses: ${nearMissCount}`,
    ``,
    `## Weather Summary`,
    weatherSummary,
    ``,
    `## Safety Summary Narrative`,
    generatedNarrative,
    ``,
    `## Top Hazard Categories`,
    topHazards.length > 0
      ? topHazards.map((item) => `- ${item.category.replace(/_/g, " ")}: ${item.count}`).join("\n")
      : "- No hazard categories captured.",
    ``,
  ].join("\n");

  return {
    reportType: "end_of_day",
    title: `End-of-Day Report - ${jobsiteName} - ${workDate}`,
    jobsiteId,
    workDate,
    narrative: generatedNarrative,
    markdown,
    metrics: {
      workDate,
      jobsiteId,
      jobsiteName,
      dapPlannedWorkCount: dapPlannedWork.length,
      fieldObservations: scopedActions.length,
      openDeficiencies,
      closedDeficiencies,
      positiveObservations,
      permitsUsed: permitCount,
      incidents: incidentCount,
      nearMisses: nearMissCount,
      weatherSummary,
      topHazardCategories: topHazards,
      highRiskObservations,
      sifCount,
      safetySummaryNarrative: generatedNarrative,
    },
  };
}

async function loadOpsMetrics({ auth, companyId }: ScopeContext, days: number) {
  const sinceIso = new Date(Date.now() - Math.max(1, days) * 24 * 60 * 60 * 1000).toISOString();
  const [actionsRes, incidentsRes, submissionsRes, permitsRes, dapsRes, activitiesRes] =
    await Promise.all([
    auth.supabase
      .from("company_corrective_actions")
      .select("id, status, category, due_at, created_at, closed_at, jobsite_id")
      .eq("company_id", companyId)
      .gte("created_at", sinceIso),
    auth.supabase
      .from("company_incidents")
      .select("id, status, category, severity, sif_flag, escalation_level, created_at, closed_at, jobsite_id")
      .eq("company_id", companyId)
      .gte("created_at", sinceIso),
    auth.supabase
      .from("company_safety_submissions")
      .select("id, category, review_status, created_at, jobsite_id")
      .eq("company_id", companyId)
      .gte("created_at", sinceIso),
    auth.supabase
      .from("company_permits")
      .select("id, status, stop_work_status, sif_flag, escalation_level, created_at, jobsite_id, dap_activity_id, observation_id")
      .eq("company_id", companyId)
      .gte("created_at", sinceIso),
    auth.supabase
      .from("company_daps")
      .select("id, status, created_at, jobsite_id")
      .eq("company_id", companyId)
      .gte("created_at", sinceIso),
    auth.supabase
      .from("company_dap_activities")
      .select("id, dap_id, activity_name, status, created_at")
      .eq("company_id", companyId)
      .gte("created_at", sinceIso),
    ]);
  if (actionsRes.error) throw new Error(actionsRes.error.message || "Failed loading corrective actions");
  if (incidentsRes.error) throw new Error(incidentsRes.error.message || "Failed loading incidents");
  if (submissionsRes.error) throw new Error(submissionsRes.error.message || "Failed loading submissions");
  if (permitsRes.error) throw new Error(permitsRes.error.message || "Failed loading permits");
  if (dapsRes.error) throw new Error(dapsRes.error.message || "Failed loading daps");
  if (activitiesRes.error) throw new Error(activitiesRes.error.message || "Failed loading dap activities");
  return {
    actions: actionsRes.data ?? [],
    incidents: incidentsRes.data ?? [],
    submissions: submissionsRes.data ?? [],
    permits: permitsRes.data ?? [],
    daps: dapsRes.data ?? [],
    dapActivities: activitiesRes.data ?? [],
  };
}

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: [
      "can_view_all_company_data",
      "can_view_analytics",
      "can_create_documents",
      "can_view_reports",
      "can_view_dashboards",
    ],
  });
  if ("error" in auth) return auth.error;
  const companyScope = await getCompanyScope({ supabase: auth.supabase, userId: auth.user.id, fallbackTeam: auth.team });
  if (!companyScope.companyId) return NextResponse.json({ reports: [] });
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status")?.trim().toLowerCase();
  let query = auth.supabase
    .from("compat_company_reports")
    .select("*")
    .eq("company_id", companyScope.companyId)
    .order("updated_at", { ascending: false });
  if (status) query = query.eq("status", status);
  let result = await query;
  if (result.error && isMissingCompatView(result.error.message)) {
    let fallbackQuery = auth.supabase
      .from("company_reports")
      .select("*")
      .eq("company_id", companyScope.companyId)
      .order("updated_at", { ascending: false });
    if (status) fallbackQuery = fallbackQuery.eq("status", status);
    result = await fallbackQuery;
  }
  if (result.error) {
    if (isMissingTable(result.error.message)) return NextResponse.json({ reports: [], warning: "Report tables are not available yet. Run latest migrations." }, { status: 500 });
    return NextResponse.json({ error: result.error.message || "Failed to load reports." }, { status: 500 });
  }
  return NextResponse.json({ reports: result.data ?? [] });
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, { requireAnyPermission: ["can_view_all_company_data", "can_view_analytics"] });
  if ("error" in auth) return auth.error;
  if (!canManage(auth.role)) return NextResponse.json({ error: "Only company admins and managers can create reports." }, { status: 403 });
  const companyScope = await getCompanyScope({ supabase: auth.supabase, userId: auth.user.id, fallbackTeam: auth.team });
  if (!companyScope.companyId) return NextResponse.json({ error: "This account is not linked to a company workspace yet." }, { status: 400 });
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const reportType = String(body?.reportType ?? "").trim().toLowerCase();
  const reportTypeFinal = reportType || "daily_report";
  if (!["daily_report", "weekly_summary", "custom", "end_of_day"].includes(reportTypeFinal)) {
    return NextResponse.json({ error: "reportType must be daily_report, weekly_summary, custom, or end_of_day." }, { status: 400 });
  }
  const title = String(body?.title ?? "").trim() || (reportTypeFinal === "weekly_summary" ? "Weekly Safety Summary" : "Daily Safety Report");
  const days = reportTypeFinal === "weekly_summary" ? 7 : 1;

  let metrics: Record<string, unknown> = {};
  if (reportTypeFinal === "end_of_day") {
    try {
      const workDate = String(body?.workDate ?? "").trim() || new Date().toISOString().slice(0, 10);
      const jobsiteId = String(body?.jobsiteId ?? "").trim() || null;
      const payload = await buildEodReportPayload({
        auth,
        companyId: companyScope.companyId,
        jobsiteId,
        workDate,
        requestedNarrative: typeof body?.narrative === "string" ? body.narrative : null,
      });
      metrics = payload.metrics;
      const generatedAt = new Date().toISOString();
      const reportResult = await auth.supabase
        .from("company_reports")
        .insert({
          company_id: companyScope.companyId,
          jobsite_id: payload.jobsiteId,
          title: payload.title,
          report_type: payload.reportType,
          status: "published",
          source_module: "eod_generator",
          file_path: null,
          generated_at: generatedAt,
          created_by: auth.user.id,
          updated_by: auth.user.id,
        })
        .select("*")
        .single();
      if (reportResult.error) {
        return NextResponse.json({ error: reportResult.error.message || "Failed to create EOD report." }, { status: 500 });
      }

      let filePath: string | null = null;
      const adminClient = createSupabaseAdminClient();
      if (adminClient) {
        const safeDate = payload.workDate.replace(/[^0-9-]/g, "");
        const reportId = String(reportResult.data.id);
        const jobsiteSegment = payload.jobsiteId ?? "unassigned";
        filePath = `companies/${companyScope.companyId}/jobsites/${jobsiteSegment}/reports/${reportId}/end-of-day-${safeDate}.md`;
        const upload = await adminClient.storage
          .from("documents")
          .upload(filePath, Buffer.from(payload.markdown, "utf8"), {
            contentType: "text/markdown; charset=utf-8",
            upsert: true,
          });
        if (!upload.error) {
          await auth.supabase.from("company_reports").update({ file_path: filePath }).eq("id", reportId).eq("company_id", companyScope.companyId);
          await auth.supabase.from("company_report_attachments").insert({
            company_id: companyScope.companyId,
            report_id: reportId,
            jobsite_id: payload.jobsiteId,
            file_path: filePath,
            file_name: `end-of-day-${safeDate}.md`,
            mime_type: "text/markdown",
            file_size: payload.markdown.length,
            created_by: auth.user.id,
          });
        }
      }

      return NextResponse.json({
        success: true,
        report: {
          ...reportResult.data,
          file_path: filePath,
        },
        generatedReport: {
          ...reportResult.data,
          file_path: filePath,
          metrics,
          narrative: payload.narrative,
        },
      });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Failed generating end-of-day report." },
        { status: 500 }
      );
    }
  } else if (reportTypeFinal !== "custom") {
    try {
      const data = await loadOpsMetrics({ auth, companyId: companyScope.companyId }, days);
      const categoryCounts = new Map<string, number>();
      for (const action of data.actions) {
        const key = (action.category ?? "uncategorized").toLowerCase();
        categoryCounts.set(key, (categoryCounts.get(key) ?? 0) + 1);
      }
      const overdueActions = data.actions.filter((action) => {
        if (action.status === "verified_closed" || !action.due_at) return false;
        const dueAt = new Date(action.due_at).getTime();
        return !Number.isNaN(dueAt) && dueAt < Date.now();
      }).length;
      const closureSamples = data.actions
        .filter((action) => action.closed_at && action.created_at)
        .map((action) => {
          const createdAt = new Date(action.created_at).getTime();
          const closedAt = new Date(action.closed_at as string).getTime();
          return Math.max(0, (closedAt - createdAt) / (1000 * 60 * 60));
        });
      const avgClosureHours =
        closureSamples.length > 0
          ? Number((closureSamples.reduce((sum, value) => sum + value, 0) / closureSamples.length).toFixed(2))
          : 0;
      const topHazardCategories = Array.from(categoryCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([category, count]) => ({ category, count }));

      metrics = {
        windowDays: days,
        totals: {
          correctiveActions: data.actions.length,
          incidents: data.incidents.length,
          permits: data.permits.length,
          submissions: data.submissions.length,
          daps: data.daps.length,
          dapActivities: data.dapActivities.length,
        },
        status: {
          correctiveOpen: data.actions.filter((item) => item.status !== "verified_closed").length,
          correctiveClosed: data.actions.filter((item) => item.status === "verified_closed").length,
          overdueActions,
          stopWorkActivePermits: data.permits.filter((item) => item.stop_work_status === "stop_work_active").length,
          sifIncidents: data.incidents.filter((item) => item.sif_flag).length,
          monitoredActivities: data.dapActivities.filter((item) => item.status === "monitored").length,
          permitLinkedActivities: data.permits.filter((item) => item.dap_activity_id).length,
          observationLinkedPermits: data.permits.filter((item) => item.observation_id).length,
        },
        kpis: {
          avgClosureHours,
        },
        topHazardCategories,
      };
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Failed to compute report metrics." },
        { status: 500 }
      );
    }
  } else {
    metrics = typeof body?.metrics === "object" && body?.metrics !== null ? (body.metrics as Record<string, unknown>) : {};
  }

  const generatedAt = new Date().toISOString();
  const result = await auth.supabase.from("company_reports").insert({
    company_id: companyScope.companyId,
    jobsite_id: String(body?.jobsiteId ?? "").trim() || null,
    title,
    report_type: reportTypeFinal,
    status: "published",
    source_module: String(body?.sourceModule ?? "").trim() || "operations",
    file_path: null,
    generated_at: generatedAt,
    created_by: auth.user.id,
    updated_by: auth.user.id,
  }).select("*").single();
  if (result.error) return NextResponse.json({ error: result.error.message || "Failed to create report." }, { status: 500 });
  return NextResponse.json({
    success: true,
    report: result.data,
    generatedReport: {
      ...result.data,
      metrics,
    },
  });
}

export async function PATCH(request: Request) {
  const auth = await authorizeRequest(request, { requireAnyPermission: ["can_view_all_company_data", "can_view_analytics"] });
  if ("error" in auth) return auth.error;
  if (!canManage(auth.role)) return NextResponse.json({ error: "Only company admins and managers can update reports." }, { status: 403 });
  const companyScope = await getCompanyScope({ supabase: auth.supabase, userId: auth.user.id, fallbackTeam: auth.team });
  if (!companyScope.companyId) return NextResponse.json({ error: "This account is not linked to a company workspace yet." }, { status: 400 });
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const id = String(body?.id ?? "").trim();
  if (!id) return NextResponse.json({ error: "Report id is required." }, { status: 400 });
  const result = await auth.supabase.from("company_reports").update({
    ...(typeof body?.title === "string" ? { title: body.title.trim() } : {}),
    ...(typeof body?.reportType === "string" ? { report_type: body.reportType.trim() } : {}),
    ...(typeof body?.status === "string" ? { status: body.status.trim().toLowerCase() } : {}),
    ...(typeof body?.sourceModule === "string" ? { source_module: body.sourceModule.trim() } : {}),
    ...(typeof body?.filePath === "string" ? { file_path: body.filePath.trim() || null } : {}),
    ...(typeof body?.generatedAt === "string" ? { generated_at: body.generatedAt.trim() || null } : {}),
    ...(typeof body?.jobsiteId === "string" ? { jobsite_id: body.jobsiteId.trim() || null } : {}),
    updated_by: auth.user.id,
  }).eq("id", id).eq("company_id", companyScope.companyId).select("*").single();
  if (result.error) return NextResponse.json({ error: result.error.message || "Failed to update report." }, { status: 500 });
  return NextResponse.json({ success: true, report: result.data });
}
