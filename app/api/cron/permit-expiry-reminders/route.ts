import { NextResponse } from "next/server";
import { isCronRequestAuthorized } from "@/lib/cronAuth";
import { withCronTelemetry } from "@/lib/cronTelemetry";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const maxDuration = 60;

// Alert when a permit expires within this many days
const EXPIRY_WINDOW_DAYS = 7;
// Minimum days between repeat alerts for the same company
const COOLDOWN_DAYS = 3;

// GET /api/cron/permit-expiry-reminders
// Runs daily — fires an in-app alert when active permits are expiring within 7 days.
// Bundles all expiring permits per company into a single notification.
// Respects a 3-day cooldown per company to avoid alert fatigue.
export async function GET(request: Request) {
  if (!isCronRequestAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return withCronTelemetry("permit-expiry-reminders", async () => {
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

    const now = new Date();
    const windowEnd = new Date(now.getTime() + EXPIRY_WINDOW_DAYS * 86_400_000);
    const cooldownStart = new Date(now.getTime() - COOLDOWN_DAYS * 86_400_000);

    // Find active permits expiring within the window
    const { data: expiringPermits, error: permitError } = await supabase
      .from("company_permits")
      .select("id, title, company_id, permit_type, expires_at")
      .lte("expires_at", windowEnd.toISOString())
      .gte("expires_at", now.toISOString())
      .in("status", ["open", "active", "in_progress", "pending"])
      .order("expires_at", { ascending: true })
      .limit(1_000);

    if (permitError) {
      return {
        response: NextResponse.json({ error: permitError.message }, { status: 500 }),
        metadata: { ok: false },
      };
    }

    if (!expiringPermits || expiringPermits.length === 0) {
      return {
        response: NextResponse.json({ ok: true, alertsSent: 0, permitsFound: 0, dryRun }),
        processedCount: 0,
        metadata: { ok: true, alertsSent: 0 },
      };
    }

    // Group by company_id
    const byCompany: Record<string, Array<{ id: string; title: string; permit_type: string; expires_at: string }>> = {};
    for (const permit of expiringPermits as Array<{ id: string; title: string; company_id: string; permit_type: string; expires_at: string }>) {
      if (!permit.company_id) continue;
      (byCompany[permit.company_id] ??= []).push({
        id: permit.id,
        title: permit.title ?? "Untitled Permit",
        permit_type: permit.permit_type ?? "permit",
        expires_at: permit.expires_at,
      });
    }

    const companyIds = Object.keys(byCompany);

    // Check cooldown — skip companies that already got an alert recently
    const { data: recentAlerts } = await supabase
      .from("company_notifications")
      .select("company_id")
      .eq("type", "permit_expiry_reminder")
      .gte("created_at", cooldownStart.toISOString())
      .in("company_id", companyIds)
      .limit(500);

    const onCooldown = new Set(
      (recentAlerts ?? []).map((n) => String((n as Record<string, unknown>).company_id ?? ""))
    );

    const toAlert = companyIds.filter((id) => !onCooldown.has(id));

    if (toAlert.length === 0) {
      return {
        response: NextResponse.json({ ok: true, alertsSent: 0, suppressed: companyIds.length, reason: "cooldown", dryRun }),
        processedCount: 0,
        metadata: { ok: true, alertsSent: 0, suppressed: companyIds.length },
      };
    }

    if (dryRun) {
      return {
        response: NextResponse.json({
          ok: true, dryRun: true, wouldAlert: toAlert.length,
          permitCounts: toAlert.map((id) => ({ companyId: id, count: byCompany[id]?.length ?? 0 })),
        }),
        processedCount: 0,
        metadata: { ok: true, dryRun: true },
      };
    }

    let totalNotificationsSent = 0;

    for (const companyId of toAlert) {
      const permits = byCompany[companyId] ?? [];
      const count = permits.length;

      // Build a preview of up to 3 permit titles
      const preview = permits.slice(0, 3).map((p) => {
        const daysLeft = Math.ceil((new Date(p.expires_at).getTime() - now.getTime()) / 86_400_000);
        return `"${p.title}" (expires in ${daysLeft}d)`;
      });
      const previewText = preview.join(", ") + (count > 3 ? ` and ${count - 3} more` : "");

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
        type: "permit_expiry_reminder",
        title: `${count} Permit${count === 1 ? "" : "s"} Expiring Soon`,
        message:
          `⏰ ${count} permit${count === 1 ? " is" : "s are"} expiring within ${EXPIRY_WINDOW_DAYS} days: ${previewText}. ` +
          `Review and renew before they lapse.`,
        link: "/safe-predict/permits",
        read: false,
      }));

      const { error: insertError } = await supabase
        .from("company_notifications")
        .insert(notifications);

      if (insertError) {
        console.error(`[permit-expiry] Failed to insert notifications for company ${companyId}:`, insertError);
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
        permitsFound: expiringPermits.length,
        expiryWindowDays: EXPIRY_WINDOW_DAYS,
        dryRun,
      }),
      processedCount: totalNotificationsSent,
      metadata: { ok: true, alertsSent: totalNotificationsSent },
    };
  });
}
