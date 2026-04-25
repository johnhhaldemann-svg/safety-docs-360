import { NextResponse } from "next/server";
import { getIndustryBenchmarkRates } from "@/lib/benchmarking/industryBenchmarkDataset";
import { incidentRatePer200kHours } from "@/lib/benchmarking/incidentRate";
import { eventToInjuryLikelihoodTable, type IncidentAnalyticsRow } from "@/lib/incidents/injuryHistoricalModel";
import { isForecasterSyntheticIncident } from "@/lib/injuryWeather/excludeForecasterIncidents";
import { likelyInjuryInsightFromSignals } from "@/lib/injuryWeather/likelyInjuryFromSignals";
import { normalizedRowsFromFetchedLiveData } from "@/lib/injuryWeather/service";
import { injurySeverityScore } from "@/lib/incidents/injurySeverityScore";
import {
  SOR_HAZARD_CATEGORY_CODES,
  SOR_HAZARD_CATEGORY_LABELS,
  SOR_HAZARD_TO_EXPOSURE_EVENTS,
  type SorHazardCategoryCode,
} from "@/lib/incidents/sorHazardCategory";
import { authorizeRequest } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { companyHasCsepPlanName, csepWorkspaceForbiddenResponse } from "@/lib/csepApiGuard";
import { buildSalesDemoInjuryAnalyticsModel } from "@/lib/demoWorkspace";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_view_analytics", "can_view_all_company_data"],
  });
  if ("error" in auth) return auth.error;
  const { searchParams } = new URL(request.url);
  const days = Math.min(730, Math.max(1, Number(searchParams.get("days") ?? "365")));
  if (auth.role === "sales_demo") {
    return NextResponse.json(buildSalesDemoInjuryAnalyticsModel(days));
  }
  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) {
    return NextResponse.json({
      sorToExposureMap: [],
      eventToInjuryModel: [],
      likelyInjuryInsight: likelyInjuryInsightFromSignals([]),
      industryBenchmarkRates: getIndustryBenchmarkRates(null),
      incidentRate: null,
      hoursWorked: null,
      incidentsForRate: 0,
      severity: { averageScore: 0, sampleSize: 0 },
      conversion: { sorToInjuryRatio: null, sorCount: 0, injuryIncidentCount: 0 },
    });
  }

  if (await companyHasCsepPlanName(auth.supabase, companyScope.companyId)) {
    return csepWorkspaceForbiddenResponse();
  }

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [companyRes, incidentsRes, sorRes, capaRes] = await Promise.all([
    auth.supabase
      .from("companies")
      .select("industry_code, hours_worked")
      .eq("id", companyScope.companyId)
      .maybeSingle(),
    auth.supabase
      .from("company_incidents")
      .select(
        "title, description, category, severity, recordable, exposure_event_type, injury_type, injury_month, injury_season, injury_day_of_week, injury_time_of_day, days_away_from_work, days_restricted, lost_time, fatality, created_at"
      )
      .eq("company_id", companyScope.companyId)
      .gte("created_at", since),
    auth.supabase
      .from("company_sor_records")
      .select("trade, category, severity, created_at, status, hazard_category_code, is_deleted")
      .eq("company_id", companyScope.companyId)
      .gte("created_at", since)
      .eq("is_deleted", false),
    auth.supabase
      .from("company_corrective_actions")
      .select("category, severity, created_at, status")
      .eq("company_id", companyScope.companyId)
      .gte("created_at", since),
  ]);

  if (incidentsRes.error) {
    return NextResponse.json(
      { error: incidentsRes.error.message || "Failed to load incidents for injury model." },
      { status: 500 }
    );
  }
  if (sorRes.error) {
    return NextResponse.json(
      { error: sorRes.error.message || "Failed to load SOR records for injury model." },
      { status: 500 }
    );
  }
  if (capaRes.error) {
    return NextResponse.json(
      { error: capaRes.error.message || "Failed to load corrective actions for injury model." },
      { status: 500 }
    );
  }

  const incidents = (incidentsRes.data ?? []).filter((row) => {
    const r = row as { title?: string | null; description?: string | null };
    return !isForecasterSyntheticIncident(r.title, r.description);
  });
  const sorRows = sorRes.data ?? [];
  const capaRows = capaRes.data ?? [];

  const insightRows = normalizedRowsFromFetchedLiveData(sorRows, capaRows, incidents);
  const companyRow =
    !companyRes.error && companyRes.data
      ? (companyRes.data as { industry_code?: string | null; hours_worked?: number | null })
      : null;
  const hoursWorked = companyRow?.hours_worked ?? null;
  const industryCode = companyRow?.industry_code ?? null;

  const incidentsForRate = incidents.filter((row) => {
    if (String(row.category ?? "").toLowerCase() !== "incident") return false;
    if ((row as { recordable?: boolean | null }).recordable === false) return false;
    return true;
  }).length;
  const incidentRate = incidentRatePer200kHours(incidentsForRate, hoursWorked);

  const injuryRows = incidents.filter((row) => String(row.category ?? "").toLowerCase() === "incident");
  let severitySum = 0;
  let severityN = 0;
  for (const row of injuryRows) {
    const r = row as {
      days_away_from_work?: number | null;
      days_restricted?: number | null;
      lost_time?: boolean | null;
      fatality?: boolean | null;
    };
    severitySum += injurySeverityScore({
      daysAwayFromWork: Number(r.days_away_from_work ?? 0),
      daysRestricted: Number(r.days_restricted ?? 0),
      lostTime: Boolean(r.lost_time),
      fatality: Boolean(r.fatality),
    });
    severityN += 1;
  }

  const sorToExposureMap = SOR_HAZARD_CATEGORY_CODES.map((code) => ({
    sorHazardCategoryCode: code,
    label: SOR_HAZARD_CATEGORY_LABELS[code as SorHazardCategoryCode],
    impliedExposureEventTypes: [...SOR_HAZARD_TO_EXPOSURE_EVENTS[code as SorHazardCategoryCode]],
  }));

  const eventToInjuryModel = eventToInjuryLikelihoodTable(incidents as IncidentAnalyticsRow[], 4);

  const injuryIncidentCount = injuryRows.length;
  const sorCount = sorRows.length;
  const sorToInjuryRatio = sorCount > 0 ? injuryIncidentCount / sorCount : null;

  const likelyInjuryInsight = likelyInjuryInsightFromSignals(insightRows);

  return NextResponse.json({
    windowDays: days,
    since,
    sorToExposureMap,
    eventToInjuryModel,
    likelyInjuryInsight,
    industryBenchmarkRates: getIndustryBenchmarkRates(industryCode),
    industryCode,
    hoursWorked,
    incidentsForRate,
    incidentRate,
    severity: {
      averageScore: severityN > 0 ? Number((severitySum / severityN).toFixed(2)) : 0,
      sampleSize: severityN,
    },
    conversion: {
      sorToInjuryRatio: sorToInjuryRatio != null ? Number(sorToInjuryRatio.toFixed(4)) : null,
      sorCount,
      injuryIncidentCount,
    },
  });
}
