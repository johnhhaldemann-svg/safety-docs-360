import { NextResponse } from "next/server";
import { isCronRequestAuthorized } from "@/lib/cronAuth";
import { refreshInjuryWeatherDailySnapshot } from "@/lib/injuryWeather/service";

export const runtime = "nodejs";
/** Vercel serverless max duration (seconds). Requires Pro for >60s on some plans. */
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!isCronRequestAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await refreshInjuryWeatherDailySnapshot();
  if (!result.ok) {
    return NextResponse.json({ error: result.error || "Snapshot refresh failed." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, snapshotDate: result.snapshotDate });
}
