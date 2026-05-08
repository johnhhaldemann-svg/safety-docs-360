import { NextResponse } from "next/server";
import { isCronRequestAuthorized } from "@/lib/cronAuth";
import { runMicrosoftProjectDailySync } from "@/lib/microsoftProject";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(request: Request) {
  if (!isCronRequestAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const maxRaw = Number(url.searchParams.get("maxCompanies") ?? "");
  const maxCompanies = Number.isFinite(maxRaw) && maxRaw > 0 ? Math.floor(maxRaw) : undefined;

  const result = await runMicrosoftProjectDailySync({ maxCompanies });
  if (!result.ok && result.companiesSeen === 0 && result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json(result);
}
