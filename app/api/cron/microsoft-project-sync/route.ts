import { NextResponse } from "next/server";
import { isCronRequestAuthorized } from "@/lib/cronAuth";
import { withCronTelemetry } from "@/lib/cronTelemetry";
import { runMicrosoftProjectDailySync } from "@/lib/microsoftProject";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(request: Request) {
  if (!isCronRequestAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return withCronTelemetry("microsoft-project-sync", async () => {
  const url = new URL(request.url);
  const maxRaw = Number(url.searchParams.get("maxCompanies") ?? "");
  const maxCompanies = Number.isFinite(maxRaw) && maxRaw > 0 ? Math.floor(maxRaw) : undefined;

  const result = await runMicrosoftProjectDailySync({ maxCompanies });
  if (!result.ok && result.companiesSeen === 0 && result.error) {
    return {
      response: NextResponse.json({ error: result.error }, { status: 500 }),
      processedCount: result.companiesSeen,
      metadata: result as unknown as Record<string, unknown>,
    };
  }

  return {
    response: NextResponse.json(result),
    processedCount: result.companiesSeen,
    metadata: result as unknown as Record<string, unknown>,
  };
  });
}
