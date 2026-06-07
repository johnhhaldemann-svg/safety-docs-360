import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { createCompanyNotification } from "@/lib/companyNotifications";

// Reminder thresholds in days from due date.
// Negative = overdue.
export type CapaReminderMilestone = "7d" | "3d" | "due" | "overdue";

type CapaItemRow = {
  id: string;
  title: string;
  status: string;
  due_at: string;
  assigned_to: string | null;
  reminder_milestones_sent: Record<string, string>;
  company_id: string;
  session_id: string;
  session: {
    corrective_action_id: string | null;
    corrective_action?: {
      id: string;
      title: string;
      created_by: string | null;
    } | null;
  } | null;
};

type CronResult = {
  ok: boolean;
  error?: string;
  itemsSeen: number;
  notificationsSent: number;
  skipped: number;
};

/**
 * Determines which milestone, if any, a CAPA item qualifies for right now.
 * Returns null if no threshold is triggered.
 */
export function resolveCapaMilestone(
  dueAt: Date,
  now: Date
): CapaReminderMilestone | null {
  const msPerDay = 1000 * 60 * 60 * 24;
  // Use floor so "due today" fires on the exact date
  const daysUntilDue = Math.floor((dueAt.getTime() - now.getTime()) / msPerDay);

  if (daysUntilDue < 0) return "overdue";
  if (daysUntilDue === 0) return "due";
  if (daysUntilDue <= 3) return "3d";
  if (daysUntilDue <= 7) return "7d";
  return null;
}

/**
 * Builds the notification copy for a given milestone.
 */
function buildNotification(
  milestone: CapaReminderMilestone,
  capaTitle: string,
  caTitle: string,
  dueAt: Date
): { title: string; body: string; priority: "low" | "normal" | "high" | "critical" } {
  const dueDateStr = dueAt.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  switch (milestone) {
    case "7d":
      return {
        title: "CAPA Due in 7 Days",
        body: `"${capaTitle}" is due on ${dueDateStr}. Associated with: ${caTitle}.`,
        priority: "normal",
      };
    case "3d":
      return {
        title: "CAPA Due in 3 Days",
        body: `"${capaTitle}" is due on ${dueDateStr}. Associated with: ${caTitle}. Please take action soon.`,
        priority: "high",
      };
    case "due":
      return {
        title: "CAPA Due Today",
        body: `"${capaTitle}" is due today (${dueDateStr}). Associated with: ${caTitle}.`,
        priority: "high",
      };
    case "overdue":
      return {
        title: "CAPA Overdue",
        body: `"${capaTitle}" was due on ${dueDateStr} and is still open. Associated with: ${caTitle}.`,
        priority: "critical",
      };
  }
}

/**
 * Main cron handler — runs daily to send CAPA due-date reminders.
 *
 * Logic per item:
 *   1. Resolve the current milestone (7d / 3d / due / overdue).
 *   2. Skip if that milestone was already sent.
 *   3. Notify the assigned user. If unassigned, notify the CA creator as fallback.
 *   4. Record the milestone in reminder_milestones_sent.
 *
 * Only items with status open or in_progress are processed.
 * Items due more than 60 days ago are skipped (stale / abandoned).
 */
export async function runCapaReminderNotificationsCron(options?: {
  maxItems?: number;
  dryRun?: boolean;
}): Promise<CronResult> {
  const { maxItems = 2000, dryRun = false } = options ?? {};

  let itemsSeen = 0;
  let notificationsSent = 0;
  let skipped = 0;

  const supabase = createSupabaseAdminClient();
  const now = new Date();

  // Lower bound: don't send overdue reminders for items more than 60 days past due
  const overdueFloor = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString();
  // Upper bound: only fetch items due within the next 8 days (to catch 7d threshold)
  const dueUpperBound = new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000).toISOString();

  // Load eligible CAPA items across all companies
  const { data: items, error } = await supabase
    .from("ca_rca_capa_items")
    .select(`
      id, title, status, due_at, assigned_to,
      reminder_milestones_sent, company_id, session_id,
      session:ca_rca_sessions (
        corrective_action_id,
        corrective_action:company_corrective_actions (
          id, title, created_by
        )
      )
    `)
    .in("status", ["open", "in_progress"])
    .not("due_at", "is", null)
    .gte("due_at", overdueFloor)
    .lte("due_at", dueUpperBound)
    .limit(maxItems);

  if (error) {
    return { ok: false, error: error.message, itemsSeen: 0, notificationsSent: 0, skipped: 0 };
  }

  const rows = (items ?? []) as CapaItemRow[];
  itemsSeen = rows.length;

  for (const item of rows) {
    const dueAt = new Date(item.due_at);
    const milestone = resolveCapaMilestone(dueAt, now);

    if (!milestone) {
      skipped++;
      continue;
    }

    // Already sent this milestone?
    const alreadySent = item.reminder_milestones_sent?.[milestone];
    if (alreadySent) {
      skipped++;
      continue;
    }

    // Resolve the corrective action for context
    const session = Array.isArray(item.session) ? item.session[0] : item.session;
    const caRaw = session?.corrective_action;
    const ca = Array.isArray(caRaw) ? caRaw[0] : caRaw;
    const caTitle = ca?.title ?? "a corrective action";
    const caId = ca?.id ?? session?.corrective_action_id ?? null;

    // Determine recipient: assigned_to first, then CA creator as fallback
    const recipientId = item.assigned_to ?? ca?.created_by ?? null;
    if (!recipientId) {
      skipped++;
      continue;
    }

    const notif = buildNotification(milestone, item.title, caTitle, dueAt);

    if (!dryRun) {
      try {
        await createCompanyNotification({
          supabase,
          companyId: item.company_id,
          recipientUserId: recipientId,
          actorUserId: null,
          eventType: `capa_reminder_${milestone}`,
          title: notif.title,
          body: notif.body,
          priority: notif.priority,
          href: caId ? `/field-id-exchange?rca=${caId}` : "/field-id-exchange",
          sourceTable: "ca_rca_capa_items",
          sourceId: item.id,
        });

        // Record the milestone so we never re-send it
        const updatedMilestones = {
          ...item.reminder_milestones_sent,
          [milestone]: now.toISOString(),
        };
        await supabase
          .from("ca_rca_capa_items")
          .update({ reminder_milestones_sent: updatedMilestones })
          .eq("id", item.id);

        notificationsSent++;
      } catch {
        // Don't abort the whole run for a single failure
        skipped++;
      }
    } else {
      // Dry run — count but don't write
      notificationsSent++;
    }
  }

  return { ok: true, itemsSeen, notificationsSent, skipped };
}
