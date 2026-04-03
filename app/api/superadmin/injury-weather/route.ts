import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { authorizeRequest, normalizeAppRole } from "@/lib/rbac";
import { appendAgentDebugNdjson } from "@/lib/agentDebugNdjsonFile";
import { getInjuryWeatherDashboardData, workScheduleFromUrlSearchParams } from "@/lib/injuryWeather/service";
import { generateInjuryWeatherAiInsights } from "@/lib/injuryWeather/ai";
import type { BehaviorSignals, InjuryWeatherDashboardData, WorkScheduleInputs } from "@/lib/injuryWeather/types";

export const runtime = "nodejs";

function parseBehaviorSignalsFromSearchParams(searchParams: URLSearchParams): Partial<BehaviorSignals> | undefined {
  const fatigue = searchParams.get("fatigueIndicators");
  const rush = searchParams.get("rushingIndicators");
  const nw = searchParams.get("newWorkerRatio");
  const ot = searchParams.get("overtimeHours");
  if (fatigue == null && rush == null && nw == null && ot == null) return undefined;
  return {
    ...(fatigue != null && fatigue !== "" ? { fatigueIndicators: Number(fatigue) } : {}),
    ...(rush != null && rush !== "" ? { rushingIndicators: Number(rush) } : {}),
    ...(nw != null && nw !== "" ? { newWorkerRatio: Number(nw) } : {}),
    ...(ot != null && ot !== "" ? { overtimeHours: Number(ot) } : {}),
  };
}

/** Cache dashboard + AI per filter set for 2h to reduce repeated OpenAI calls. */
const loadCachedDashboard = unstable_cache(
  async (key: string) => {
    const filters = JSON.parse(key) as {
      month: string | null;
      trade: string | null;
      trades: string[] | null;
      workforceTotal: number | null;
      hoursWorked: number | null;
      stateCode: string | null;
      behaviorSignals: Partial<BehaviorSignals> | null;
      workSchedule: Partial<WorkScheduleInputs> | null;
      companyId: string | null;
      jobsiteId: string | null;
    };
    return getInjuryWeatherDashboardData({
      month: filters.month ?? undefined,
      trade: filters.trade ?? undefined,
      trades: filters.trades ?? undefined,
      workforceTotal: filters.workforceTotal ?? undefined,
      hoursWorked: filters.hoursWorked ?? undefined,
      stateCode: filters.stateCode ?? undefined,
      behaviorSignals: filters.behaviorSignals ?? undefined,
      workSchedule: filters.workSchedule ?? undefined,
      companyId: filters.companyId ?? undefined,
      jobsiteId: filters.jobsiteId ?? undefined,
    });
  },
  ["injury-weather-dashboard"],
  { revalidate: 7200 }
);

const loadCachedDashboardWithAi = unstable_cache(
  async (key: string) => {
    const data = await loadCachedDashboard(key);
    const aiInsights = await generateInjuryWeatherAiInsights(data);
    return { data, aiInsights };
  },
  ["injury-weather-with-ai"],
  { revalidate: 7200 }
);

function isSuperAdminRole(role: string) {
  return normalizeAppRole(role) === "super_admin";
}

function wantsCacheBypass(searchParams: URLSearchParams) {
  const v = searchParams.get("refresh") ?? searchParams.get("nocache");
  return v === "1" || v === "true" || v === "yes";
}

function logInjuryWeatherResponse(
  data: InjuryWeatherDashboardData,
  meta: { bypassCache: boolean; includeAi: boolean; cacheHit: boolean }
) {
  appendAgentDebugNdjson({
    hypothesisId: "IW-ROUTE",
    location: "injury-weather/route.ts:GET",
    message: "response sent",
    data: {
      bypassCache: meta.bypassCache,
      includeAi: meta.includeAi,
      cacheHit: meta.cacheHit,
      riskSignalCount: data.summary.riskSignalCount,
      forecastMode: data.summary.forecastMode,
      likelyHasData: data.summary.likelyInjuryInsight.hasData,
      likelyHeadline: data.summary.likelyInjuryInsight.headline,
      provenanceMode: data.signalProvenance.mode,
    },
  });
}

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_access_internal_admin", "can_view_analytics"],
  });
  if ("error" in auth) return auth.error;
  if (!isSuperAdminRole(auth.role)) {
    return NextResponse.json({ error: "Superadmin access required." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month")?.trim() || undefined;
  const trade = searchParams.get("trade")?.trim() || undefined;
  const trades = searchParams
    .get("trades")
    ?.split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  const workforceRaw = searchParams.get("workforceTotal");
  const workforceTotal = workforceRaw ? Number(workforceRaw) : undefined;
  const hoursRaw = searchParams.get("hoursWorked");
  const hoursWorked = hoursRaw ? Number(hoursRaw) : undefined;
  const stateCode = searchParams.get("state")?.trim() || undefined;
  const behaviorSignals = parseBehaviorSignalsFromSearchParams(searchParams);
  const workSchedule = workScheduleFromUrlSearchParams(searchParams);
  const companyId = searchParams.get("companyId")?.trim() || undefined;
  const jobsiteIdParam = searchParams.get("jobsiteId")?.trim() || undefined;
  const jobsiteId = companyId && jobsiteIdParam ? jobsiteIdParam : undefined;
  const includeAi = searchParams.get("includeAi") === "true";
  const bypassCache = wantsCacheBypass(searchParams);
  const filterKey = JSON.stringify({
    month: month ?? null,
    trade: trade ?? null,
    trades: trades && trades.length > 0 ? [...trades].sort() : null,
    workforceTotal: workforceTotal && Number.isFinite(workforceTotal) ? workforceTotal : null,
    hoursWorked: hoursWorked && Number.isFinite(hoursWorked) ? hoursWorked : null,
    stateCode: stateCode ?? null,
    behaviorSignals: behaviorSignals ?? null,
    workSchedule: workSchedule ?? null,
    companyId: companyId ?? null,
    jobsiteId: jobsiteId ?? null,
  });

  const filters = {
    month,
    trade,
    trades: trades && trades.length > 0 ? trades : undefined,
    workforceTotal: workforceTotal && Number.isFinite(workforceTotal) ? workforceTotal : undefined,
    hoursWorked: hoursWorked && Number.isFinite(hoursWorked) ? hoursWorked : undefined,
    stateCode,
    behaviorSignals,
    workSchedule,
    companyId,
    jobsiteId,
  };

  if (bypassCache) {
    const data = await getInjuryWeatherDashboardData(filters);
    logInjuryWeatherResponse(data, { bypassCache: true, includeAi, cacheHit: false });
    if (includeAi) {
      const aiInsights = await generateInjuryWeatherAiInsights(data);
      return NextResponse.json({ ...data, aiInsights });
    }
    return NextResponse.json(data);
  }

  if (includeAi) {
    const { data, aiInsights } = await loadCachedDashboardWithAi(filterKey);
    logInjuryWeatherResponse(data, { bypassCache: false, includeAi: true, cacheHit: true });
    return NextResponse.json({ ...data, aiInsights });
  }
  const data = await loadCachedDashboard(filterKey);
  logInjuryWeatherResponse(data, { bypassCache: false, includeAi: false, cacheHit: true });
  return NextResponse.json(data);
}
