import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { authorizeRequest, normalizeAppRole } from "@/lib/rbac";
import {
  applyAiForecastOverride,
  generateInjuryWeatherAiInsights,
  isInjuryWeatherAiForecastOverrideEnabled,
} from "@/lib/injuryWeather/ai";
import { getInjuryWeatherDashboardData, workScheduleFromUrlSearchParams } from "@/lib/injuryWeather/service";
import type { BehaviorSignals, InjuryWeatherAiForecastMeta, WorkScheduleInputs } from "@/lib/injuryWeather/types";

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

/** Cache dashboard per filter set (short TTL so new SOR/incidents show up without always using refresh=1). */
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
  { revalidate: 300 }
);

type DashboardFilterKey = {
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

function dashboardKeyString(f: DashboardFilterKey): string {
  return JSON.stringify(f);
}

async function buildInjuryWeatherAiResponse(
  data: Awaited<ReturnType<typeof getInjuryWeatherDashboardData>>,
  aiOverrideEnabled: boolean
) {
  const hasOpenAiKey = Boolean(process.env.OPENAI_API_KEY?.trim());
  const { insights, forecastOverride } = await generateInjuryWeatherAiInsights(data, {
    requestForecastOverride: aiOverrideEnabled,
  });

  const aiForecastMetaBase: InjuryWeatherAiForecastMeta = {
    applied: false,
    schemaVersion: "1",
  };

  if (!aiOverrideEnabled) {
    return { ...data, aiInsights: insights, aiForecastMeta: { ...aiForecastMetaBase, reason: "disabled" as const } };
  }

  const deterministicBaseline = data;
  if (!hasOpenAiKey) {
    return {
      ...data,
      aiInsights: insights,
      deterministicBaseline,
      aiForecastMeta: { ...aiForecastMetaBase, reason: "no_api_key" as const },
    };
  }

  if (forecastOverride) {
    const merged = applyAiForecastOverride(data, forecastOverride);
    return {
      ...merged,
      aiInsights: insights,
      deterministicBaseline,
      aiForecastMeta: { applied: true, schemaVersion: "1" },
    };
  }

  return {
    ...data,
    aiInsights: insights,
    deterministicBaseline,
    aiForecastMeta: { ...aiForecastMetaBase, reason: "validation_failed" as const },
  };
}

const loadCachedDashboardWithAi = unstable_cache(
  async (fullKey: string) => {
    const parsed = JSON.parse(fullKey) as DashboardFilterKey & { aiOverrideEnabled: boolean };
    const { aiOverrideEnabled, ...filterRest } = parsed;
    const data = await loadCachedDashboard(dashboardKeyString(filterRest));
    return buildInjuryWeatherAiResponse(data, aiOverrideEnabled);
  },
  ["injury-weather-with-ai"],
  { revalidate: 1800 }
);

function isSuperAdminRole(role: string) {
  return normalizeAppRole(role) === "super_admin";
}

function wantsCacheBypass(searchParams: URLSearchParams) {
  const v = searchParams.get("refresh") ?? searchParams.get("nocache");
  return v === "1" || v === "true" || v === "yes";
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
  const aiOverrideEnabled = isInjuryWeatherAiForecastOverrideEnabled();
  const dashboardFilter: DashboardFilterKey = {
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
  };
  const filterKey = dashboardKeyString(dashboardFilter);
  const fullAiCacheKey = JSON.stringify({ ...dashboardFilter, aiOverrideEnabled });

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
    if (includeAi) {
      const body = await buildInjuryWeatherAiResponse(data, aiOverrideEnabled);
      return NextResponse.json(body);
    }
    return NextResponse.json(data);
  }

  if (includeAi) {
    const body = await loadCachedDashboardWithAi(fullAiCacheKey);
    return NextResponse.json(body);
  }
  const data = await loadCachedDashboard(filterKey);
  return NextResponse.json(data);
}
