import { NextResponse } from "next/server";
import { isCronRequestAuthorized } from "@/lib/cronAuth";
import { withCronTelemetry } from "@/lib/cronTelemetry";
import { runCapaReminderNotificationsCron } from "@/lib/capaReminderNotifications";

export const runtime = "nodejs";
export const maxDuration = 60;

function readOptions(request: Request) {
  const url = new URL(request.url);
  const maxItems = Number(url.searchParams.get("maxItems") ?? "");
  const dryRun = url.searchParams.get("dryRun") === "true";
  return {
    maxItems: Number.isFinite(maxItems) && maxItems > 0 ? Math.min(maxItems, 5000) : undefined,
    dryRun,
  };
}

// GET /api/cron/capa-due-reminders
// Runs daily — sends in-app notifications for CAPA items due in 7d, 3d, today, or overdue.
export async function GET(request: Request) {
  if (!isCronRequestAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return withCronTelemetry("capa-due-reminders", async () => {
    const { maxItems, dryRun } = readOptions(request);
    const result = await runCapaReminderNotificationsCron({ maxItems, dryRun });

    if (!result.ok) {
      return {
        response: NextResponse.json(
          { error: result.error || "CAPA reminder cron failed.", result },
          { status: 500 }
        ),
        metadata: result as unknown as Record<string, unknown>,
      };
    }

    return {
      response: NextResponse.json(result),
      processedCount: result.notificationsSent,
      metadata: result as unknown as Record<string, unknown>,
    };
  });
}
