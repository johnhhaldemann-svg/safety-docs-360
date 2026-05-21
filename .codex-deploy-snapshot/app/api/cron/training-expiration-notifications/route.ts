import { NextResponse } from "next/server";
import { isCronRequestAuthorized } from "@/lib/cronAuth";
import { withCronTelemetry } from "@/lib/cronTelemetry";
import { runTrainingExpirationNotificationCron } from "@/lib/trainingExpirationNotifications";

export const runtime = "nodejs";
export const maxDuration = 120;

function readMaxItems(request: Request) {
  const url = new URL(request.url);
  const raw = Number(url.searchParams.get("maxItems") ?? process.env.TRAINING_EXPIRATION_CRON_MAX_ITEMS ?? "");
  if (!Number.isFinite(raw) || raw <= 0) return undefined;
  return Math.min(Math.floor(raw), 5000);
}

export async function GET(request: Request) {
  if (!isCronRequestAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return withCronTelemetry("training-expiration-notifications", async () => {
    const result = await runTrainingExpirationNotificationCron({
      maxItems: readMaxItems(request),
    });

    if (!result.ok) {
      return {
        response: NextResponse.json(
          { error: result.error || "Training expiration notification cron failed.", result },
          { status: 500 }
        ),
        metadata: result as unknown as Record<string, unknown>,
      };
    }

    return {
      response: NextResponse.json(result),
      processedCount: result.itemsSeen,
      metadata: result as unknown as Record<string, unknown>,
    };
  });
}
