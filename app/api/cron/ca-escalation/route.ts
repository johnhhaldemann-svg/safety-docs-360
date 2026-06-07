import { NextResponse } from "next/server";
import { isCronRequestAuthorized } from "@/lib/cronAuth";
import { withCronTelemetry } from "@/lib/cronTelemetry";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const maxDuration = 60;

// A CA must be at least this many days past its due_at before we escalate
const OVERDUE_DAYS = 7;
// Minimum days between escalation alerts per company (avoid notification fatigue)
const COOLDOWN_DAYS = 3;

// GET /api/cron/ca-escalation
// Runs daily — sends a bundled escalation alert to safety managers whenever a
// company has one or more corrective actions that are OVERDUE_DAYS+ past their
// due date with no recent activity. Respects a COOLDOWN_DAYS cooldown per
// company so the same team is not flooded.
export async function GET(request: Request) {
  if (!isCronRequestAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return withCronTelemetry("ca-escalation", async () => {
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

    const overdueCutoff  = new Date(Date.now() - OVERDUE_DAYS * 86_400_000).toISOString();
    const cooldownStart  = new Date(Date.now() - COOLDOWN_DAYS * 86_400_000).toISOString();

    // Fetch CAs that are open/in-progress, past their due_at by OVERDUE_DAYS,
    // and haven't been updated in that same period (truly stale).
    const { data: staleCas, error: caError } = await supabase
      .from("company_corrective_actions")
      .select("id, title, company_id, assigned_to, due_at, severity, category")
      .in("status", ["open", "in_progress"])
      .lt("due_at", overdueCutoff)
      .lt("updated_at", overdueCutoff)
      .eq("is_deleted", false)
      .limit(500);

    if (caError) {
      return {
        response: NextResponse.json({ error: caError.message }, { status: 500 }),
        metadata: { ok: false },
      };
    }

    if (!staleCas || staleCas.length === 0) {
      return {
        response: NextResponse.json({ ok: true, alertsSent: 0, reason: "no stale CAs" }),
        processedCount: 0,
        metadata: { ok: true, alertsSent: 0 },
      };
    }

    // Group by company
    type CaRow = {
      id: string;
      title: string;
      company_id: string;
      assigned_to: string | null;
      due_at: string | null;
      severity: string | null;
      category: string | null;
    };

    const byCompany: Record<string, CaRow[]> = {};
    for (const ca of staleCas as CaRow[]) {
      if (!ca.company_id) continue;
      if (!byCompany[ca.company_id]) byCompany[ca.company_id] = [];
      byCompany[ca.company_id].push(ca);
    }

    const companyIds = Object.keys(byCompany);

    // Check cooldown — skip companies that got a ca_escalation alert recently
    const { data: recentAlerts } = await supabase
      .from("company_notifications")
      .select("company_id")
      .eq("type", "ca_escalation")
      .gte("created_at", cooldownStart)
      .in("company_id", companyIds)
      .limit(500);

    const onCooldown = new Set(
      (recentAlerts ?? []).map((n) => String((n as Record<string, unknown>).company_id ?? ""))
    );

    const toAlert = companyIds.filter((id) => !onCooldown.has(id));

    if (toAlert.length === 0) {
      return {
        response: NextResponse.json({
          ok: true, alertsSent: 0, suppressed: companyIds.length, reason: "cooldown", dryRun,
        }),
        processedCount: 0,
        metadata: { ok: true, alertsSent: 0 },
      };
    }

    if (dryRun) {
      return {
        response: NextResponse.json({
          ok: true, dryRun: true,
          wouldAlert: toAlert.length,
          totalStaleCas: staleCas.length,
          breakdown: toAlert.map((id) => ({
            companyId: id,
            staleCount: byCompany[id]?.length ?? 0,
          })),
        }),
        processedCount: 0,
        metadata: { ok: true, dryRun: true },
      };
    }

    let totalNotificationsSent = 0;

    for (const companyId of toAlert) {
      const cas = byCompany[companyId] ?? [];
      if (cas.length === 0) continue;

      // Fetch safety managers / admins to notify
      const { data: recipients } = await supabase
        .from("company_memberships")
        .select("user_id")
        .eq("company_id", companyId)
        .in("role", ["company_admin", "safety_manager"])
        .eq("status", "active")
        .limit(20);

      if (!recipients || recipients.length === 0) continue;

      // Sort CAs by severity so the most critical appear first in the message
      const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
      const sorted = [...cas].sort(
        (a, b) => (severityOrder[a.severity ?? "low"] ?? 3) - (severityOrder[b.severity ?? "low"] ?? 3)
      );

      const preview = sorted
        .slice(0, 3)
        .map((ca) => `"${ca.title}"`)
        .join(", ");

      const more = cas.length > 3 ? ` and ${cas.length - 3} more` : "";

      const notifications = (recipients as Array<{ user_id: string }>).map((r) => ({
        user_id: r.user_id,
        company_id: companyId,
        type: "ca_escalation",
        title: `${cas.length} Corrective Action${cas.length === 1 ? "" : "s"} Require Attention`,
        message:
          `⏰ ${cas.length} corrective action${cas.length === 1 ? " is" : "s are"} overdue by ${OVERDUE_DAYS}+ days with no recent activity: ${preview}${more}. ` +
          `Review and reassign if the owner is unavailable.`,
        link: "/corrective-actions?filter=overdue",
        read: false,
      }));

      const { error: insertError } = await supabase
        .from("company_notifications")
        .insert(notifications);

      if (insertError) {
        console.error(
          `[ca-escalation] Failed to insert notifications for company ${companyId}:`,
          insertError
        );
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
        staleCasFound: staleCas.length,
        overdueDays: OVERDUE_DAYS,
        cooldownDays: COOLDOWN_DAYS,
        dryRun,
      }),
      processedCount: totalNotificationsSent,
      metadata: { ok: true, alertsSent: totalNotificationsSent },
    };
  });
}
