import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { authorizeRequest, normalizeAppRole } from "@/lib/rbac";
import { runInjuryWeatherBacktest, workScheduleFromUrlSearchParams } from "@/lib/injuryWeather/service";
import type { WorkScheduleInputs } from "@/lib/injuryWeather/types";

export const runtime = "nodejs";

const loadCachedBacktest = unstable_cache(
  async (key: string) => {
    const opts = JSON.parse(key) as {
      lookbackMonths: number | null;
      stateCode: string | null;
      workforceTotal: number | null;
      hoursWorked: number | null;
      workSchedule: Partial<WorkScheduleInputs> | null;
    };
    return runInjuryWeatherBacktest({
      lookbackMonths: opts.lookbackMonths ?? undefined,
      stateCode: opts.stateCode ?? undefined,
      workforceTotal: opts.workforceTotal ?? undefined,
      hoursWorked: opts.hoursWorked ?? undefined,
      workSchedule: opts.workSchedule ?? undefined,
    });
  },
  ["injury-weather-backtest"],
  { revalidate: 7200 }
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
  const monthsRaw = searchParams.get("months");
  const months = monthsRaw ? Number(monthsRaw) : undefined;
  const stateCode = searchParams.get("state")?.trim() || undefined;
  const workforceRaw = searchParams.get("workforceTotal");
  const workforceTotal = workforceRaw ? Number(workforceRaw) : undefined;
  const hoursRaw = searchParams.get("hoursWorked");
  const hoursWorked = hoursRaw ? Number(hoursRaw) : undefined;
  const workSchedule = workScheduleFromUrlSearchParams(searchParams);
  const bypassCache = wantsCacheBypass(searchParams);

  const opts = {
    lookbackMonths: months && Number.isFinite(months) ? months : undefined,
    stateCode,
    workforceTotal: workforceTotal && Number.isFinite(workforceTotal) ? workforceTotal : undefined,
    hoursWorked: hoursWorked && Number.isFinite(hoursWorked) ? hoursWorked : undefined,
    workSchedule,
  };

  const filterKey = JSON.stringify({
    lookbackMonths: opts.lookbackMonths ?? null,
    stateCode: stateCode ?? null,
    workforceTotal: opts.workforceTotal && Number.isFinite(opts.workforceTotal) ? opts.workforceTotal : null,
    hoursWorked: opts.hoursWorked && Number.isFinite(opts.hoursWorked) ? opts.hoursWorked : null,
    workSchedule: workSchedule ?? null,
  });

  const result = bypassCache ? await runInjuryWeatherBacktest(opts) : await loadCachedBacktest(filterKey);

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json(result);
}
