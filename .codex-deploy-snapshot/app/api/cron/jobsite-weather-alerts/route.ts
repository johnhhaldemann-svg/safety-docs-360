import { NextResponse } from "next/server";
import { isCronRequestAuthorized } from "@/lib/cronAuth";
import { withCronTelemetry } from "@/lib/cronTelemetry";
import { checkJobsiteWeatherAlerts } from "@/lib/weather/checkJobsiteWeatherAlerts";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(request: Request) {
  if (!isCronRequestAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return withCronTelemetry("jobsite-weather-alerts", async () => {
  const result = await checkJobsiteWeatherAlerts();
  if (!result.ok) {
    return {
      response: NextResponse.json({ error: result.error || "Jobsite weather alert check failed.", result }, { status: 500 }),
      metadata: result as unknown as Record<string, unknown>,
    };
  }

  return {
    response: NextResponse.json(result),
    processedCount:
      typeof result.jobsitesSeen === "number"
        ? result.jobsitesSeen
        : null,
    metadata: result as unknown as Record<string, unknown>,
  };
  });
}
