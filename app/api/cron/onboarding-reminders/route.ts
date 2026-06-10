import { NextResponse } from "next/server";
import { isCronRequestAuthorized } from "@/lib/cronAuth";
import { withCronTelemetry } from "@/lib/cronTelemetry";
import { runOnboardingReminders } from "@/lib/onboardingReminders";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(request: Request) {
  if (!isCronRequestAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return withCronTelemetry("onboarding-reminders", async () => {
    const result = await runOnboardingReminders();
    if (!result.ok) {
      return {
        response: NextResponse.json(
          { error: result.error || "Onboarding reminder run failed.", result },
          { status: 500 }
        ),
        metadata: result as unknown as Record<string, unknown>,
      };
    }

    return {
      response: NextResponse.json(result),
      processedCount: "sent" in result ? result.sent : null,
      metadata: result as unknown as Record<string, unknown>,
    };
  });
}
