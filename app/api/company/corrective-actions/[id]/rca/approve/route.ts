import { NextResponse } from "next/server";
import { authorizeRequest, isAdminRole } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { createCompanyNotification } from "@/lib/companyNotifications";
import { requestAiResponsesText } from "@/lib/ai/responses";
import { resolveCompanyAiDefaultModel } from "@/lib/ai/defaultModel";

export const runtime = "nodejs";

type RouteParams = { params: Promise<{ id: string }> };

const SIGN_OFF_ROLES = new Set(["company_admin", "safety_manager", "manager"]);

function canSignOff(role: string) {
  return isAdminRole(role) || SIGN_OFF_ROLES.has(role);
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

// POST /api/company/corrective-actions/[id]/rca/approve
// HSE sign-off: AI generates a summary, session is marked approved, reporter notified
export async function POST(request: Request, { params }: RouteParams) {
  const { id: actionId } = await params;
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_access_field_work", "can_view_dashboards"],
  });
  if ("error" in auth) return auth.error;

  if (!canSignOff(auth.role)) {
    return NextResponse.json(
      { error: "Only HSE managers and company admins can sign off on an RCA." },
      { status: 403 }
    );
  }

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) {
    return NextResponse.json({ error: "Not linked to a company workspace." }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as {
    reviewNotes?: string;
    rootCauseConfirmed?: string;
  } | null;

  // Load corrective action + session
  const actionResult = await auth.supabase
    .from("company_corrective_actions")
    .select("id, title, description, category, severity, rca_session_id, created_by")
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
    created_by: string | null;
  };

  if (!action.rca_session_id) {
    return NextResponse.json({ error: "No RCA session exists for this corrective action." }, { status: 404 });
  }

  const sessionResult = await auth.supabase
    .from("ca_rca_sessions")
    .select("id, status, rca_method, current_step")
    .eq("id", action.rca_session_id)
    .eq("company_id", companyScope.companyId)
    .maybeSingle();

  if (sessionResult.error || !sessionResult.data) {
    return NextResponse.json({ error: "RCA session not found." }, { status: 404 });
  }

  const session = sessionResult.data as {
    id: string;
    status: string;
    rca_method: string;
    current_step: string;
  };

  if (session.status === "approved" || session.status === "closed") {
    return NextResponse.json({ error: "This RCA has already been signed off." }, { status: 409 });
  }

  // Load conversation for AI summary generation
  const messagesResult = await auth.supabase
    .from("ca_rca_messages")
    .select("role, content, step_key")
    .eq("session_id", session.id)
    .eq("company_id", companyScope.companyId)
    .neq("role", "system")
    .order("created_at", { ascending: true })
    .limit(60);

  const messages = (messagesResult.data ?? []) as Array<{
    role: string;
    content: string;
    step_key: string | null;
  }>;

  // Load CAPA items for summary context
  const capaResult = await auth.supabase
    .from("ca_rca_capa_items")
    .select("title, priority, status")
    .eq("session_id", session.id)
    .eq("company_id", companyScope.companyId);

  const capaItems = (capaResult.data ?? []) as Array<{
    title: string;
    priority: string;
    status: string;
  }>;

  // Build AI summary of the investigation
  const conversationText = messages
    .filter((m) => m.role === "user")
    .map((m) => `[${(m.step_key ?? "").replace(/_/g, " ")}] ${m.content}`)
    .join("\n");

  const summaryPrompt = [
    "You are a safety professional summarising a completed Root Cause Analysis investigation.",
    "Write a concise 3-5 sentence summary of the investigation findings below.",
    "Focus on: what happened, the root cause(s) identified, and the key corrective actions planned.",
    "Do not add information that is not in the transcript. Write in past tense, professional tone.",
    "",
    `Corrective Action: ${action.title}`,
    `Category: ${action.category} · Severity: ${action.severity}`,
    `RCA Method: ${session.rca_method.replace(/_/g, " ")}`,
    "",
    "Investigation responses:",
    conversationText || "No user responses recorded.",
    "",
    capaItems.length > 0
      ? `CAPA Items: ${capaItems.map((c) => c.title).join("; ")}`
      : "No CAPA items recorded.",
  ].join("\n");

  const model =
    process.env.RCA_AI_MODEL?.trim() ||
    process.env.COMPANY_AI_MODEL?.trim() ||
    resolveCompanyAiDefaultModel("gpt-4o-mini");

  const summaryResponse = await requestAiResponsesText({
    model,
    input: summaryPrompt,
    surface: "corrective-actions.rca-approve",
    maxAttempts: 2,
  });

  const summary = summaryResponse.text?.trim() || null;
  const rootCauseConfirmed = clean(body?.rootCauseConfirmed) || null;
  const now = new Date().toISOString();

  // Mark session approved
  await auth.supabase
    .from("ca_rca_sessions")
    .update({
      status: "approved",
      current_step: "review",
      summary,
      root_cause_confirmed: rootCauseConfirmed,
      approved_by: auth.user.id,
      approved_at: now,
      updated_at: now,
    })
    .eq("id", session.id);

  // Notify the person who started the CA (if different from approver)
  if (action.created_by && action.created_by !== auth.user.id) {
    await createCompanyNotification({
      supabase: auth.supabase,
      companyId: companyScope.companyId,
      recipientUserId: action.created_by,
      actorUserId: auth.user.id,
      eventType: "ca_rca_approved",
      title: "RCA Signed Off",
      body: `The root cause analysis for "${action.title}" has been reviewed and signed off.`,
      priority: "normal",
      href: `/field-id-exchange?rca=${actionId}`,
      sourceTable: "company_corrective_actions",
      sourceId: actionId,
    });
  }

  return NextResponse.json({
    approved: true,
    summary,
    approvedAt: now,
  });
}
