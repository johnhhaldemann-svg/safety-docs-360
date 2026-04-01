import { NextResponse } from "next/server";
import { authorizeRequest, normalizeAppRole } from "@/lib/rbac";
import { runInjuryWeatherBacktest } from "@/lib/injuryWeather/service";

export const runtime = "nodejs";

function isSuperAdminRole(role: string) {
  return normalizeAppRole(role) === "super_admin";
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

  const result = await runInjuryWeatherBacktest({
    lookbackMonths: months && Number.isFinite(months) ? months : undefined,
    stateCode,
    workforceTotal: workforceTotal && Number.isFinite(workforceTotal) ? workforceTotal : undefined,
    hoursWorked: hoursWorked && Number.isFinite(hoursWorked) ? hoursWorked : undefined,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json(result);
}
