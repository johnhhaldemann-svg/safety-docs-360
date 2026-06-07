import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { createCompanyNotification } from "@/lib/companyNotifications";
import { selectRcaMethod, buildOpeningMessage, getStepsForMethod } from "@/lib/rcaAi";

export const runtime = "nodejs";

const HSE_ROLES = new Set(["company_admin", "safety_manager", "manager"]);

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/company/corrective-actions/[id]/rca
// Returns the active RCA session with messages, findings, and CAPA items
export async function GET(request: Request, { params }: RouteParams) {
  const { id: actionId } = await params;
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_access_field_work", "can_view_dashboards"],
  });
  if ("error" in auth) return auth.error;

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) {
    return NextResponse.json({ error: "Not linked to a company workspace." }, { status: 400 });
  }

  const actionResult = await auth.supabase
    .from("company_corrective_actions")
    .select("id, title, description, category, severity, status, rca_required, rca_session_id")
    .eq("id", actionId)
    .eq("company_id", companyScope.companyId)
    .eq("is_deleted", false)
    .maybeSingle();

  if (actionResult.error || !actionResult.data) {
    return NextResponse.json({ error: "Corrective action not found." }, { status: 404 });
  }

  const action = actionResult.data as {
    id: string;
    title: string;
    description: string | null;
    category: string;
    severity: string;
    status: string;
    rca_required: boolean;
    rca_session_id: string | null;
  };

  if (!action.rca_session_id) {
    return NextResponse.json({ session: null, action });
  }

  const [sessionResult, messagesResult, findingsResult, capaResult] = await Promise.all([
    auth.supabase
      .from("ca_rca_sessions")
      .select("*")
      .eq("id", action.rca_session_id)
      .eq("company_id", companyScope.companyId)
      .maybeSingle(),
    auth.supabase
      .from("ca_rca_messages")
      .select("id, role, content, step_key, created_at")
      .eq("session_id", action.rca_session_id)
      .eq("company_id", companyScope.companyId)
      .neq("role", "system")
      .order("created_at", { ascending: true }),
    auth.supabase
      .from("ca_rca_findings")
      .select("id, finding_type, category, description, why_level, sort_order")
      .eq("session_id", action.rca_session_id)
      .eq("company_id", companyScope.companyId)
      .order("sort_order", { ascending: true }),
    auth.supabase
      .from("ca_rca_capa_items")
      .select("id, title, description, priority, status, assigned_to, due_at, completed_at")
      .eq("session_id", action.rca_session_id)
      .eq("company_id", companyScope.companyId)
      .order("created_at", { ascending: true }),
  ]);

  const userCanSignOff =
    HSE_ROLES.has(auth.role ?? "") ||
    (auth.role ?? "").toLowerCase().includes("admin");

  return NextResponse.json({
    action,
    session: sessionResult.data ?? null,
    messages: messagesResult.data ?? [],
    findings: findingsResult.data ?? [],
    capaItems: capaResult.data ?? [],
    userCanSignOff,
  });
}

// POST /api/company/corrective-actions/[id]/rca
// Creates a new RCA session and notifies HSE users
export async function POST(request: Request, { params }: RouteParams) {
  const { id: actionId } = await params;
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_access_field_work"],
  });
  if ("error" in auth) return auth.error;

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) {
    return NextResponse.json({ error: "Not linked to a company workspace." }, { status: 400 });
  }

  const actionResult = await auth.supabase
    .from("company_corrective_actions")
    .select("id, title, description, category, severity, status, rca_required, rca_session_id, company_id")
    .eq("id", actionId)
    .eq("company_id", companyScope.companyId)
    .eq("is_deleted", false)
    .maybeSingle();

  if (actionResult.error || !actionResult.data) {
    return NextResponse.json({ error: "Corrective action not found." }, { status: 404 });
  }

  const action = actionResult.data as {
    id: string;
    title: string;
    description: string | null;
    category: string;
    severity: string;
    rca_session_id: string | null;
    company_id: string;
  };

  if (action.rca_session_id) {
    return NextResponse.json(
      { error: "An RCA session already exists for this corrective action." },
      { status: 409 }
    );
  }

  const method = selectRcaMethod(action.category, action.severity);
  const steps = getStepsForMethod(method);

  // Create the session
  const sessionInsert = await auth.supabase
    .from("ca_rca_sessions")
    .insert({
      company_id: companyScope.companyId,
      corrective_action_id: actionId,
      rca_method: method,
      status: "in_progress",
      current_step: steps[0],
      created_by: auth.user.id,
    })
    .select("id")
    .single();

  if (sessionInsert.error || !sessionInsert.data) {
    return NextResponse.json({ error: "Failed to create RCA session." }, { status: 500 });
  }

  const sessionId = (sessionInsert.data as { id: string }).id;

  // Insert opening assistant message
  const openingContent = buildOpeningMessage({
    caTitle: action.title,
    caCategory: action.category,
    caSeverity: action.severity,
    method,
  });

  await auth.supabase.from("ca_rca_messages").insert({
    session_id: sessionId,
    company_id: companyScope.companyId,
    role: "assistant",
    content: openingContent,
    step_key: steps[0],
  });

  // Link session back to the corrective action and mark rca_required
  await auth.supabase
    .from("company_corrective_actions")
    .update({ rca_session_id: sessionId, rca_required: true })
    .eq("id", actionId)
    .eq("company_id", companyScope.companyId);

  // Notify HSE users (company_admin, safety_manager, manager)
  const membersResult = await auth.supabase
    .from("company_users")
    .select("user_id, role")
    .eq("company_id", companyScope.companyId)
    .eq("status", "active")
    .in("role", Array.from(HSE_ROLES));

  const hseUserIds: string[] = [];
  if (!membersResult.error && membersResult.data) {
    const rows = membersResult.data as Array<{ user_id: string; role: string }>;
    for (const row of rows) {
      if (row.user_id === auth.user.id) continue;
      hseUserIds.push(row.user_id);
      await createCompanyNotification({
        supabase: auth.supabase,
        companyId: companyScope.companyId,
        recipientUserId: row.user_id,
        actorUserId: auth.user.id,
        eventType: "ca_rca_started",
        title: "RCA Started — Review Required",
        body: `A root cause analysis has been started for: ${action.title}`,
        priority: action.severity === "critical" || action.severity === "high" ? "high" : "normal",
        href: `/field-id-exchange?rca=${actionId}`,
        sourceTable: "company_corrective_actions",
        sourceId: actionId,
      });
    }
  }

  // Record who was notified on the session
  if (hseUserIds.length > 0) {
    await auth.supabase
      .from("ca_rca_sessions")
      .update({
        hse_notified_at: new Date().toISOString(),
        hse_notified_user_ids: hseUserIds,
      })
      .eq("id", sessionId);
  }

  return NextResponse.json({
    sessionId,
    method,
    steps,
    hseNotified: hseUserIds.length,
    openingMessage: openingContent,
  });
}
