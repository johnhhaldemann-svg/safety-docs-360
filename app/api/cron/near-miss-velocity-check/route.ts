import { NextResponse } from "next/server";
import { isCronRequestAuthorized } from "@/lib/cronAuth";
import { withCronTelemetry } from "@/lib/cronTelemetry";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const maxDuration = 60;

// Minimum near-misses of the same category within the window to trigger an alert
const VELOCITY_THRESHOLD = 3;
// Rolling window in days
const WINDOW_DAYS = 30;
// Minimum days between repeat alerts for the same company + category
const COOLDOWN_DAYS = 7;

// GET /api/cron/near-miss-velocity-check
// Runs daily — fires an in-app alert when 3+ near-misses of the same category
// occur within 30 days at the same company. Respects a 7-day cooldown per
// company/category pair to avoid alert fatigue.
export async function GET(request: Request) {
  if (!isCronRequestAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return withCronTelemetry("near-miss-velocity-check", async () => {
    const supabase = createSupabaseAdminClient();
    if (!supabase) {
      return {
        response: NextResponse.json(
          { error: "Supabase admin client could not be initialised — check SUPABASE_SERVICE_ROLE_KEY." },
          { status: 500 }
        ),
        metadata: { ok: false },
      };
    }

    const url = new URL(request.url);
    const dryRun = url.searchParams.get("dryRun") === "true";

    const windowStart = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString();
    const cooldownStart = new Date(Date.now() - COOLDOWN_DAYS * 86_400_000).toISOString();

    // Fetch near-miss counts grouped by company_id + category in the window.
    // Supabase doesn't support GROUP BY natively, so we pull raw rows and
    // aggregate in JS. Limit to a reasonable batch size (2 000 rows should
    // cover most deployments; raise if needed).
    const { data: nearMissRows, error: nmError } = await supabase
      .from("company_incidents")
      .select("company_id, category")
      .eq("category", "near_miss")
      .gte("occurred_at", windowStart)
      .limit(2_000);

    if (nmError) {
      return {
        response: NextResponse.json({ error: nmError.message }, { status: 500 }),
        metadata: { ok: false },
      };
    }

    // Aggregate: count by company_id (near_miss is already filtered by category)
    const countByCompany: Record<string, number> = {};
    for (const row of nearMissRows ?? []) {
      const key = String((row as Record<string, unknown>).company_id ?? "");
      if (!key) continue;
      countByCompany[key] = (countByCompany[key] ?? 0) + 1;
    }

    // Filter companies that hit the threshold
    const triggeredCompanyIds = Object.entries(countByCompany)
      .filter(([, count]) => count >= VELOCITY_THRESHOLD)
      .map(([companyId]) => companyId);

    if (triggeredCompanyIds.length === 0) {
      return {
        response: NextResponse.json({ ok: true, alertsSent: 0, companiesChecked: Object.keys(countByCompany).length, dryRun }),
        processedCount: 0,
        metadata: { ok: true, alertsSent: 0 },
      };
    }

    // Check cooldown: look for recent velocity alerts per company
    const { data: recentAlerts } = await supabase
      .from("company_notifications")
      .select("company_id")
      .eq("type", "near_miss_velocity_alert")
      .gte("created_at", cooldownStart)
      .in("company_id", triggeredCompanyIds)
      .limit(500);

    // Build a set of company_ids that are still in cooldown
    const onCooldown = new Set(
      (recentAlerts ?? []).map((n) => String((n as Record<string, unknown>).company_id ?? ""))
    );

    const toAlert = triggeredCompanyIds.filter((id) => !onCooldown.has(id));

    if (toAlert.length === 0) {
      return {
        response: NextResponse.json({ ok: true, alertsSent: 0, suppressed: triggeredCompanyIds.length, reason: "cooldown", dryRun }),
        processedCount: 0,
        metadata: { ok: true, alertsSent: 0, suppressed: triggeredCompanyIds.length },
      };
    }

    if (dryRun) {
      return {
        response: NextResponse.json({
          ok: true, dryRun: true, wouldAlert: toAlert.length,
          nearMissCounts: toAlert.map((id) => ({ companyId: id, count: countByCompany[id] })),
        }),
        processedCount: 0,
        metadata: { ok: true, dryRun: true },
      };
    }

    // For each company, get the safety manager / admin recipients
    let totalNotificationsSent = 0;

    for (const companyId of toAlert) {
      const count = countByCompany[companyId] ?? VELOCITY_THRESHOLD;

      const { data: recipients } = await supabase
        .from("company_memberships")
        .select("user_id")
        .eq("company_id", companyId)
        .in("role", ["company_admin", "safety_manager"])
        .eq("status", "active")
        .limit(20);

      if (!recipients || recipients.length === 0) continue;

      const notifications = (recipients as Array<{ user_id: string }>).map((r) => ({
        user_id: r.user_id,
        company_id: companyId,
        type: "near_miss_velocity_alert",
        title: "Near-Miss Velocity Alert",
        message:
          `⚠️ ${count} near-miss incident${count === 1 ? "" : "s"} have been reported in the last ${WINDOW_DAYS} days. ` +
          `Review the pattern for corrective action before an injury occurs.`,
        link: "/leading-indicators",
        read: false,
      }));

      const { error: insertError } = await supabase
        .from("company_notifications")
        .insert(notifications);

      if (insertError) {
        console.error(`[near-miss-velocity] Failed to insert notifications for company ${companyId}:`, insertError);
      } else {
        totalNotificationsSent += notifications.length;
      }
    }

    return {
      response: NextResponse.json({
        ok: true,
        alertsSent: totalNotificationsSent,
        companiesAlerted: toAlert.length,
        companiesOnCooldown: onCooldown.size,
        windowDays: WINDOW_DAYS,
        threshold: VELOCITY_THRESHOLD,
        dryRun,
      }),
      processedCount: totalNotificationsSent,
      metadata: { ok: true, alertsSent: totalNotificationsSent },
    };
  });
}
