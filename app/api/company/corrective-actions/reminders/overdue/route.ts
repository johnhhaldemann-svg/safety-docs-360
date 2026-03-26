import { NextResponse } from "next/server";
import { authorizeRequest, isAdminRole } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";

export const runtime = "nodejs";

const REMINDER_LOOKBACK_HOURS = 24;

function canManageCorrectiveActions(role: string) {
  return isAdminRole(role) || role === "company_admin" || role === "manager";
}

function isMissingCorrectiveActionsTable(message?: string | null) {
  return (message ?? "").toLowerCase().includes("company_corrective_action");
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_view_all_company_data", "can_view_analytics"],
  });

  if ("error" in auth) {
    return auth.error;
  }

  if (!canManageCorrectiveActions(auth.role)) {
    return NextResponse.json(
      { error: "Only company admins and operations managers can run overdue reminders." },
      { status: 403 }
    );
  }

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
  });

  if (!companyScope.companyId) {
    return NextResponse.json(
      { error: "This account is not linked to a company workspace yet." },
      { status: 400 }
    );
  }

  const nowIso = new Date().toISOString();
  const lookbackIso = new Date(Date.now() - REMINDER_LOOKBACK_HOURS * 60 * 60 * 1000).toISOString();

  const overdueResult = await auth.supabase
    .from("company_corrective_actions")
    .select("id, due_at, status, assigned_user_id, title")
    .eq("company_id", companyScope.companyId)
    .neq("status", "closed")
    .not("due_at", "is", null)
    .lt("due_at", nowIso);

  if (overdueResult.error) {
    if (isMissingCorrectiveActionsTable(overdueResult.error.message)) {
      return NextResponse.json(
        {
          error:
            "Corrective action tracking tables are not available yet. Run the latest Supabase migration first.",
        },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: overdueResult.error.message || "Failed to load overdue corrective actions." },
      { status: 500 }
    );
  }

  const overdueActions = overdueResult.data ?? [];
  if (overdueActions.length === 0) {
    return NextResponse.json({
      success: true,
      created: 0,
      skipped: 0,
      message: "No overdue corrective actions were found.",
    });
  }

  const actionIds = overdueActions.map((action) => action.id);
  const recentReminderResult = await auth.supabase
    .from("company_corrective_action_events")
    .select("action_id")
    .eq("company_id", companyScope.companyId)
    .eq("event_type", "overdue_reminder")
    .gte("created_at", lookbackIso)
    .in("action_id", actionIds);

  if (recentReminderResult.error) {
    return NextResponse.json(
      { error: recentReminderResult.error.message || "Failed to load recent reminders." },
      { status: 500 }
    );
  }

  const recentlyReminded = new Set(
    ((recentReminderResult.data as Array<{ action_id: string }> | null) ?? []).map(
      (row) => row.action_id
    )
  );

  const eventsToInsert = overdueActions
    .filter((action) => !recentlyReminded.has(action.id))
    .map((action) => ({
      action_id: action.id,
      company_id: companyScope.companyId,
      event_type: "overdue_reminder",
      detail: `Overdue reminder generated for "${action.title}".`,
      event_payload: {
        dueAt: action.due_at,
        assignedUserId: action.assigned_user_id ?? null,
        generatedAt: nowIso,
      },
      created_by: auth.user.id,
    }));

  if (eventsToInsert.length > 0) {
    const insertResult = await auth.supabase
      .from("company_corrective_action_events")
      .insert(eventsToInsert);

    if (insertResult.error) {
      return NextResponse.json(
        { error: insertResult.error.message || "Failed to create overdue reminder events." },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({
    success: true,
    created: eventsToInsert.length,
    skipped: overdueActions.length - eventsToInsert.length,
    message: `Generated ${eventsToInsert.length} overdue reminder event(s).`,
  });
}
