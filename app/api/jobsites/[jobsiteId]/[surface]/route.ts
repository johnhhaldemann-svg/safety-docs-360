import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import { getCompanyScope, normalizeWorkspaceUuid } from "@/lib/companyScope";
import { evaluateEmergencyActionPlanReadiness } from "@/lib/jobsiteEmergencyActionPlan";
import { buildJobsiteLaunchReadiness } from "@/lib/jobsiteLaunchReadiness";
import { buildTopJobsiteRisks, type JobsiteTopRiskEvidenceRow } from "@/lib/jobsiteTopRisks";

export const runtime = "nodejs";

type Params = { jobsiteId: string; surface: string };

type SupabaseLike = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => PromiseLike<{
          data: {
            id: string;
            company_id: string;
            name: string | null;
            status: string | null;
            jobsite_number: string | null;
            project_number: string | null;
            location: string | null;
            project_manager?: string | null;
            safety_lead?: string | null;
            zip_code?: string | null;
            weather_address_line_1?: string | null;
            weather_address_line_2?: string | null;
            weather_city?: string | null;
            weather_state?: string | null;
            weather_country?: string | null;
            start_date?: string | null;
            end_date?: string | null;
            notes?: string | null;
          } | null;
          error: { message?: string | null } | null;
        }>;
      };
    };
  };
};

/** Match `/api/company/jobsites`: canonical company jobsites only. */
async function resolveJobsiteById(supabase: SupabaseLike, jobsiteId: string) {
  return supabase
    .from("company_jobsites")
    .select("id, company_id, name, status, jobsite_number, project_number, location, project_manager, safety_lead, zip_code, weather_address_line_1, weather_address_line_2, weather_city, weather_state, weather_country, start_date, end_date, notes")
    .eq("id", jobsiteId)
    .maybeSingle();
}

const SURFACES = new Set([
  "overview",
  "live-view",
  "jsa",
  "permits",
  "incidents",
  "reports",
  "documents",
  "analytics",
  "team",
]);

async function fetchFromSameOrigin(request: Request, path: string) {
  const origin = new URL(request.url).origin;
  const response = await fetch(`${origin}${path}`, {
    headers: request.headers,
    cache: "no-store",
  });
  const json = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  return { ok: response.ok, status: response.status, json };
}

function filterByJobsiteId<T extends { jobsite_id?: string | null }>(rows: T[], jobsiteId: string) {
  const target = normalizeWorkspaceUuid(jobsiteId);
  return rows.filter((row) => normalizeWorkspaceUuid(row.jobsite_id ?? "") === target);
}

function stringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item ?? "").trim()).filter(Boolean);
  if (typeof value === "string") return value.split(",").map((item) => item.trim()).filter(Boolean);
  return [];
}

function riskEvidenceFromRows(
  rows: Array<Record<string, unknown>>,
  source: JobsiteTopRiskEvidenceRow["source"]
): JobsiteTopRiskEvidenceRow[] {
  return rows.map((row) => ({
    source,
    id: typeof row.id === "string" ? row.id : null,
    title:
      typeof row.title === "string"
        ? row.title
        : typeof row.name === "string"
          ? row.name
          : typeof row.summary === "string"
            ? row.summary
            : null,
    category:
      typeof row.category === "string"
        ? row.category
        : typeof row.incident_type === "string"
          ? row.incident_type
          : typeof row.observation_type === "string"
            ? row.observation_type
            : null,
    severity: typeof row.severity === "string" ? row.severity : null,
    priority: typeof row.priority === "string" ? row.priority : null,
    status: typeof row.status === "string" ? row.status : null,
    riskLevel:
      typeof row.risk_level === "string"
        ? row.risk_level
        : typeof row.riskLevel === "string"
          ? row.riskLevel
          : null,
    isHighRisk: typeof row.is_high_risk === "boolean" ? row.is_high_risk : typeof row.isHighRisk === "boolean" ? row.isHighRisk : null,
    sifPotential: Boolean(row.sif_potential),
    sifFlag: Boolean(row.sif_flag),
    stopWorkStatus: typeof row.stop_work_status === "string" ? row.stop_work_status : null,
    escalationLevel: typeof row.escalation_level === "string" ? row.escalation_level : null,
    hazardCategories: stringArray(row.hazard_categories ?? row.hazardCategories),
    permitTriggers: stringArray(row.permit_triggers ?? row.permitTriggers),
    permitType: typeof row.permit_type === "string" ? row.permit_type : null,
    description:
      typeof row.description === "string"
        ? row.description
        : typeof row.detail === "string"
          ? row.detail
          : typeof row.work_area === "string"
            ? row.work_area
            : null,
    notes: typeof row.notes === "string" ? row.notes : null,
    createdAt: typeof row.created_at === "string" ? row.created_at : null,
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : null,
  }));
}

function isMissingScheduleTable(message?: string | null) {
  const normalized = (message ?? "").toLowerCase();
  return (
    normalized.includes("company_jobsite_schedule_items") ||
    normalized.includes("schema cache") ||
    normalized.includes("does not exist") ||
    normalized.includes("could not find")
  );
}

function isPermitBlocker(row: Record<string, unknown>) {
  const status = String(row.status ?? row.review_status ?? "").toLowerCase();
  const stopWork = String(row.stop_work_status ?? "").toLowerCase();
  const escalation = String(row.escalation_level ?? "").toLowerCase();
  return (
    status.includes("blocked") ||
    status.includes("rejected") ||
    status.includes("suspended") ||
    status.includes("stop") ||
    stopWork.includes("stop") ||
    escalation === "critical"
  );
}

function isPermitExpired(row: Record<string, unknown>, today: string) {
  const expiresAt = String(row.expires_at ?? row.due_at ?? "").slice(0, 10);
  const status = String(row.status ?? "").toLowerCase();
  return status.includes("expired") || Boolean(expiresAt && expiresAt < today);
}

function isHighRiskSchedule(row: Record<string, unknown>) {
  const risk = String(row.risk_level ?? "").toLowerCase();
  return row.is_high_risk === true || risk === "high" || risk === "critical";
}

function isOverdueOpenAction(row: Record<string, unknown>, nowMs: number) {
  const status = String(row.status ?? "").toLowerCase();
  if (status === "verified_closed" || status === "closed") return false;
  const due = typeof row.due_at === "string" ? Date.parse(row.due_at) : Number.NaN;
  return Number.isFinite(due) && due < nowMs;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<Params> }
) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: [
      "can_view_all_company_data",
      "can_view_analytics",
      "can_view_dashboards",
      "can_manage_company_users",
      "can_create_documents",
    ],
  });
  if ("error" in auth) {
    return auth.error;
  }

  const { jobsiteId, surface } = await params;
  if (!SURFACES.has(surface)) {
    return NextResponse.json({ error: "Unknown jobsite surface." }, { status: 404 });
  }

  const scope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!scope.companyId) {
    return NextResponse.json({ error: "No company scope found for user." }, { status: 400 });
  }

  const jobsitesResult = await resolveJobsiteById(
    auth.supabase as unknown as SupabaseLike,
    jobsiteId
  );
  if (jobsitesResult.error) {
    return NextResponse.json(
      { error: jobsitesResult.error.message || "Failed to load jobsite." },
      { status: 500 }
    );
  }
  const row = jobsitesResult.data;
  const jobsiteCompanyNorm =
    row &&
    scope.companyId &&
    normalizeWorkspaceUuid(row.company_id) === normalizeWorkspaceUuid(scope.companyId);
  if (!row || !jobsiteCompanyNorm) {
    return NextResponse.json({ error: "Jobsite not found in your company scope." }, { status: 404 });
  }
  const jobsite = row;

  const [jsas, permits, incidents, reports, actions, users, documents, analytics, activities, assignments] =
    await Promise.all([
      fetchFromSameOrigin(request, "/api/company/jsas"),
      fetchFromSameOrigin(request, "/api/company/permits"),
      fetchFromSameOrigin(request, "/api/company/incidents"),
      fetchFromSameOrigin(request, "/api/company/reports"),
      fetchFromSameOrigin(request, "/api/company/corrective-actions"),
      fetchFromSameOrigin(request, "/api/company/users"),
      fetchFromSameOrigin(request, "/api/workspace/documents"),
      fetchFromSameOrigin(request, "/api/company/analytics/summary"),
      fetchFromSameOrigin(request, `/api/company/jsa-activities?workDate=${new Date().toISOString().slice(0, 10)}`),
      fetchFromSameOrigin(request, "/api/company/jobsite-assignments"),
    ]);

  const emergencyProfileResult = await auth.supabase
    .from("company_jobsite_emergency_profiles")
    .select("id, company_id, jobsite_id, emergency_contact_name, emergency_contact_phone, responder_access_instructions, responder_site_address, assembly_area, secondary_assembly_area, command_post_location, evacuation_shelter_notes, weather_shelter_location, lightning_plan, tornado_plan, aed_location, first_aid_location, fire_extinguisher_locations, spill_kit_locations, rescue_equipment_locations, nearest_medical_name, nearest_medical_address, nearest_medical_phone, nearest_medical_route, media_contact_name, media_contact_phone, media_statement_instructions, regulatory_contact_name, regulatory_contact_phone, regulatory_reporting_instructions, call_chain, utility_contacts, after_hours_contacts, backup_contacts, incident_notification_timeline, post_incident_requirements, notes, revision_date, last_reviewed_at, last_reviewed_by, created_at, updated_at")
    .eq("company_id", scope.companyId)
    .eq("jobsite_id", jobsiteId)
    .is("archived_at", null)
    .maybeSingle();
  const emergencyProfile = emergencyProfileResult.error ? null : emergencyProfileResult.data;
  const emergencyReadiness = evaluateEmergencyActionPlanReadiness({
    profile: emergencyProfile,
    jobsiteStatus: jobsite.status,
  });

  const jsasRows = filterByJobsiteId(
    ((jsas.json?.jsas as unknown[]) ?? []) as Array<{ jobsite_id?: string | null }>,
    jobsiteId
  );
  const permitsRows = filterByJobsiteId(((permits.json?.permits as unknown[]) ?? []) as Array<{ jobsite_id?: string | null }>, jobsiteId);
  const incidentsRows = filterByJobsiteId(((incidents.json?.incidents as unknown[]) ?? []) as Array<{ jobsite_id?: string | null }>, jobsiteId);
  const reportsRows = filterByJobsiteId(((reports.json?.reports as unknown[]) ?? []) as Array<{ jobsite_id?: string | null }>, jobsiteId);
  const actionsRows = filterByJobsiteId(((actions.json?.actions as unknown[]) ?? []) as Array<{ jobsite_id?: string | null }>, jobsiteId);
  const docsRows = (((documents.json?.documents as unknown[]) ?? []) as Array<{ project_name?: string | null }>).filter(
    (doc) => (doc.project_name ?? "").trim().toLowerCase() === (jobsite.name ?? "").trim().toLowerCase()
  );
  const usersRows = ((users.json?.users as unknown[]) ?? []) as unknown[];
  const assignmentRows = ((assignments.json?.assignments as unknown[]) ?? []) as unknown[];
  const activitiesRows = filterByJobsiteId(
    ((activities.json?.activities as unknown[]) ?? []) as Array<{ jobsite_id?: string | null }>,
    jobsiteId
  );

  if (surface === "jsa") return NextResponse.json({ jobsite, jsas: jsasRows });
  if (surface === "permits") return NextResponse.json({ jobsite, permits: permitsRows });
  if (surface === "incidents") return NextResponse.json({ jobsite, incidents: incidentsRows });
  if (surface === "reports") return NextResponse.json({ jobsite, reports: reportsRows });
  if (surface === "live-view")
    return NextResponse.json({ jobsite, observations: actionsRows, activities: activitiesRows });
  if (surface === "documents") return NextResponse.json({ jobsite, documents: docsRows });
  if (surface === "team") return NextResponse.json({ jobsite, users: usersRows, assignments: assignmentRows });
  if (surface === "analytics") {
    if (!analytics.ok) {
      return NextResponse.json(
        analytics.json ?? { error: "Failed to load analytics summary." },
        { status: analytics.status }
      );
    }
    const summary = (analytics.json?.summary as Record<string, unknown> | undefined) ?? {};
    const riskRows = ((summary.jobsiteRiskScore as unknown[]) ?? []) as Array<{ jobsiteId?: string }>;
    const jid = normalizeWorkspaceUuid(jobsiteId);
    return NextResponse.json({
      jobsite,
      analytics: {
        ...summary,
        jobsiteRiskScore: riskRows.filter(
          (row) => normalizeWorkspaceUuid(String(row.jobsiteId ?? "")) === jid
        ),
      },
    });
  }

  const scheduleResult = await auth.supabase
    .from("company_jobsite_schedule_items")
    .select("id, title, status, work_start_date, work_end_date, trade, work_area, crew_or_contractor, supervisor_name, risk_level, is_high_risk, hazard_categories, permit_triggers, required_controls, notes, created_at, updated_at")
    .eq("company_id", scope.companyId)
    .eq("jobsite_id", jobsiteId)
    .is("archived_at", null)
    .limit(100);
  const scheduleRows =
    scheduleResult.error && isMissingScheduleTable(scheduleResult.error.message)
      ? []
      : (((scheduleResult.data ?? []) as Array<Record<string, unknown>>) ?? []);

  const today = new Date().toISOString().slice(0, 10);
  const nowMs = Date.now();
  const observationRows = (actionsRows as Array<Record<string, unknown>>) ?? [];
  const permitRows = (permitsRows as Array<Record<string, unknown>>) ?? [];
  const incidentRows = (incidentsRows as Array<Record<string, unknown>>) ?? [];
  const activityRows = (activitiesRows as Array<Record<string, unknown>>) ?? [];
  const topJobsiteRisks = buildTopJobsiteRisks([
    ...riskEvidenceFromRows(incidentRows, "incident"),
    ...riskEvidenceFromRows(observationRows, "corrective_action"),
    ...riskEvidenceFromRows(permitRows, "permit"),
    ...riskEvidenceFromRows(scheduleRows, "scheduled_work"),
    ...riskEvidenceFromRows(activityRows, "activity"),
  ]);
  const workPlannedToday = activityRows.length;
  const activePermits = permitRows.filter((row) => String(row.status ?? "").toLowerCase() === "active").length;
  const highRiskScheduleCount = scheduleRows.filter(isHighRiskSchedule).length;
  const permitBlockerCount = permitRows.filter(isPermitBlocker).length;
  const expiredPermitCount = permitRows.filter((row) => isPermitExpired(row, today)).length;
  const openObservations = observationRows.filter(
    (row) => String(row.status ?? "").toLowerCase() !== "verified_closed"
  ).length;
  const overdueActions = observationRows.filter((row) => isOverdueOpenAction(row, nowMs)).length;
  const highRiskItems = observationRows.filter((row) => {
    const severity = String(row.severity ?? "").toLowerCase();
    const priority = String(row.priority ?? "").toLowerCase();
    const status = String(row.status ?? "").toLowerCase();
    return severity === "high" || severity === "critical" || priority === "high" || status === "stop_work";
  }).length;
  const sifExposures = observationRows.filter((row) => Boolean(row.sif_potential)).length;
  const positiveObservations = observationRows.filter(
    (row) => String(row.observation_type ?? "").toLowerCase() === "positive"
  ).length;
  const closedToday = observationRows.filter((row) => {
    if (String(row.status ?? "").toLowerCase() !== "verified_closed") return false;
    const closedAt = String(row.closed_at ?? row.updated_at ?? "").slice(0, 10);
    return closedAt === today;
  }).length;
  const recentIncidents = [...incidentRows]
    .sort((a, b) =>
      String(b.created_at ?? "").localeCompare(String(a.created_at ?? ""))
    )
    .slice(0, 5);

  const analyticsIssue = analytics.ok
    ? null
    : (typeof analytics.json?.error === "string" ? analytics.json.error.trim() : "") ||
      (typeof analytics.json?.warning === "string" ? analytics.json.warning.trim() : "") ||
      "Analytics summary could not be loaded.";

  const links = {
    liveView: `/jobsites/${jobsiteId}/live-view`,
    emergencyActionPlan: `/jobsites/${jobsiteId}/emergency-action-plan`,
    schedule: `/jobsites/${jobsiteId}/schedule`,
    jsa: `/jobsites/${jobsiteId}/jsa`,
    permits: `/jobsites/${jobsiteId}/permits`,
    incidents: `/jobsites/${jobsiteId}/incidents`,
    reports: `/jobsites/${jobsiteId}/reports`,
    documents: `/jobsites/${jobsiteId}/documents`,
    analytics: `/jobsites/${jobsiteId}/analytics`,
    team: `/jobsites/${jobsiteId}/team`,
  };
  const launchReadiness = buildJobsiteLaunchReadiness({
    emergencyActionPlanReadiness: emergencyReadiness.readiness,
    emergencyActionPlanReviewStale: emergencyReadiness.reviewStale,
    emergencyActionPlanImmediateReviewNeeded: emergencyReadiness.immediateReviewNeeded,
    emergencyActionPlanMissingCount: emergencyReadiness.missingFields.length,
    topJobsiteRisks,
    workPlannedToday,
    highRiskScheduleCount,
    permitCount: permitRows.length,
    activePermitCount: activePermits,
    permitBlockerCount,
    expiredPermitCount,
    workforceCount: usersRows.length,
    documentCount: docsRows.length,
    reportCount: reportsRows.length,
    incidentCount: incidentRows.length,
    recentIncidentCount: recentIncidents.length,
    openActionCount: openObservations,
    overdueActionCount: overdueActions,
    highRiskItemCount: highRiskItems,
    sifExposureCount: sifExposures,
    activityCount: activityRows.length,
    links: {
      emergency: links.emergencyActionPlan,
      risk: links.liveView,
      work_plan: links.schedule,
      permits: links.permits,
      workforce: links.team,
      documents: links.documents,
      incidents: links.incidents,
      activity: links.liveView,
    },
  });

  return NextResponse.json({
    jobsite,
    overview: {
      jsas: jsasRows.length,
      permits: permitsRows.length,
      incidents: incidentsRows.length,
      reports: reportsRows.length,
      observations: actionsRows.length,
      documents: docsRows.length,
      users: usersRows.length,
    },
    users: usersRows,
    widgets: {
      workPlannedToday,
      activePermits,
      openObservations,
      highRiskItems,
      sifExposures,
      positiveObservations,
      closedToday,
      recentIncidents,
      emergencyActionPlanReadiness: emergencyReadiness.readiness,
      emergencyActionPlanMissingCount: emergencyReadiness.missingFields.length,
    },
    launchReadiness,
    topJobsiteRisks,
    emergencyActionPlan: {
      profile: emergencyProfile,
      readiness: emergencyReadiness.readiness,
      missingFields: emergencyReadiness.missingFields,
      lastReviewedAt: emergencyReadiness.lastReviewedAt,
      lastReviewedBy: emergencyReadiness.lastReviewedBy,
      reviewStale: emergencyReadiness.reviewStale,
      immediateReviewNeeded: emergencyReadiness.immediateReviewNeeded,
    },
    links,
    ...(analyticsIssue ? { analyticsSummaryIssue: analyticsIssue } : {}),
  });
}
