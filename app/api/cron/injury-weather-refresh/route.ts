import { NextResponse } from "next/server";
import { refreshInjuryWeatherDailySnapshot } from "@/lib/injuryWeather/service";

export const runtime = "nodejs";
/** Vercel serverless max duration (seconds). Requires Pro for >60s on some plans. */
export const maxDuration = 60;

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const bearer = request.headers.get("authorization") || "";
  if (bearer === `Bearer ${secret}`) return true;
  const querySecret = new URL(request.url).searchParams.get("secret");
  return querySecret === secret;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await refreshInjuryWeatherDailySnapshot();
  if (!result.ok) {
    return NextResponse.json({ error: result.error || "Snapshot refresh failed." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, snapshotDate: result.snapshotDate });
}
