import { NextResponse } from "next/server";
import { isCronRequestAuthorized } from "@/lib/cronAuth";
import { checkJobsiteWeatherAlerts } from "@/lib/weather/checkJobsiteWeatherAlerts";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(request: Request) {
  if (!isCronRequestAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await checkJobsiteWeatherAlerts();
  if (!result.ok) {
    return NextResponse.json({ error: result.error || "Jobsite weather alert check failed.", result }, { status: 500 });
  }

  return NextResponse.json(result);
}
