import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { generateRcaReportPdf } from "@/lib/rcaReportPdf";
import type {
  RcaReportSession,
  RcaReportAction,
  RcaReportMessage,
  RcaReportFinding,
  RcaReportCapaItem,
} from "@/lib/rcaReportPdf";

export const runtime = "nodejs";

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/company/corrective-actions/[id]/rca/report-pdf
// Generates and streams the RCA PDF report
export async function GET(request: Request, { params }: RouteParams) {
  const { id: actionId } = await params;
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_access_field_work", "can_view_dashboards", "can_view_analytics"],
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

  // Load corrective action + jobsite + company
  const actionResult = await auth.supabase
    .from("company_corrective_actions")
    .select(`
      id, title, description, category, severity, status,
      rca_session_id,
      jobsite:jobsite_id ( name ),
      company:company_id ( name )
    `)
    .eq("id", actionId)
    .eq("company_id", companyScope.companyId)
    .eq("is_deleted", false)
    .maybeSingle();

  if (actionResult.error || !actionResult.data) {
    return NextResponse.json({ error: "Corrective action not found." }, { status: 404 });
  }

  const raw = actionResult.data as Record<string, unknown>;
  const jobsite = raw.jobsite as { name?: string } | null;
  const company = raw.company as { name?: string } | null;

  const action: RcaReportAction = {
    id: String(raw.id),
    title: String(raw.title ?? ""),
    description: raw.description ? String(raw.description) : null,
    category: String(raw.category ?? ""),
    severity: String(raw.severity ?? ""),
    status: String(raw.status ?? ""),
    jobsite_name: jobsite?.name ?? null,
    company_name: company?.name ?? null,
  };

  if (!raw.rca_session_id) {
    return NextResponse.json({ error: "No RCA session exists for this corrective action." }, { status: 404 });
  }

  const sessionId = String(raw.rca_session_id);

  // Load session + approver/creator names
  const [sessionResult, messagesResult, findingsResult, capaResult] = await Promise.all([
    auth.supabase
      .from("ca_rca_sessions")
      .select(`
        id, rca_method, status, current_step,
        summary, root_cause_confirmed,
        hse_notified_at, approved_at,
        created_at,
        approver:approved_by ( raw_user_meta_data ),
        creator:created_by ( raw_user_meta_data )
      `)
      .eq("id", sessionId)
      .eq("company_id", companyScope.companyId)
      .maybeSingle(),
    auth.supabase
      .from("ca_rca_messages")
      .select("role, content, step_key, created_at")
      .eq("session_id", sessionId)
      .eq("company_id", companyScope.companyId)
      .neq("role", "system")
      .order("created_at", { ascending: true })
      .limit(200),
    auth.supabase
      .from("ca_rca_findings")
      .select("finding_type, category, description, why_level, sort_order")
      .eq("session_id", sessionId)
      .eq("company_id", companyScope.companyId)
      .order("sort_order", { ascending: true }),
    auth.supabase
      .from("ca_rca_capa_items")
      .select(`
        title, description, priority, status,
        due_at, completed_at,
        assignee:assigned_to ( raw_user_meta_data )
      `)
      .eq("session_id", sessionId)
      .eq("company_id", companyScope.companyId)
      .order("created_at", { ascending: true }),
  ]);

  if (sessionResult.error || !sessionResult.data) {
    return NextResponse.json({ error: "RCA session not found." }, { status: 404 });
  }

  function resolveDisplayName(userRecord: unknown): string | null {
    if (!userRecord || typeof userRecord !== "object") return null;
    const meta = (userRecord as Record<string, unknown>).raw_user_meta_data;
    if (!meta || typeof meta !== "object") return null;
    const m = meta as Record<string, unknown>;
    return (
      (typeof m.full_name === "string" ? m.full_name : null) ||
      (typeof m.name === "string" ? m.name : null) ||
      (typeof m.email === "string" ? m.email : null) ||
      null
    );
  }

  const sessionRaw = sessionResult.data as Record<string, unknown>;

  const session: RcaReportSession = {
    id: String(sessionRaw.id),
    rca_method: String(sessionRaw.rca_method ?? "five_whys") as RcaReportSession["rca_method"],
    status: String(sessionRaw.status ?? ""),
    current_step: String(sessionRaw.current_step ?? "") as RcaReportSession["current_step"],
    summary: sessionRaw.summary ? String(sessionRaw.summary) : null,
    root_cause_confirmed: sessionRaw.root_cause_confirmed ? String(sessionRaw.root_cause_confirmed) : null,
    hse_notified_at: sessionRaw.hse_notified_at ? String(sessionRaw.hse_notified_at) : null,
    approved_by_name: resolveDisplayName(sessionRaw.approver),
    approved_at: sessionRaw.approved_at ? String(sessionRaw.approved_at) : null,
    created_by_name: resolveDisplayName(sessionRaw.creator),
    created_at: String(sessionRaw.created_at ?? new Date().toISOString()),
  };

  const messages: RcaReportMessage[] = ((messagesResult.data ?? []) as Array<Record<string, unknown>>).map((m) => ({
    role: m.role === "user" ? "user" : "assistant",
    content: String(m.content ?? ""),
    step_key: m.step_key ? String(m.step_key) : null,
    created_at: String(m.created_at ?? ""),
  }));

  const findings: RcaReportFinding[] = ((findingsResult.data ?? []) as Array<Record<string, unknown>>).map((f) => ({
    finding_type: String(f.finding_type ?? ""),
    category: f.category ? String(f.category) : null,
    description: String(f.description ?? ""),
    why_level: typeof f.why_level === "number" ? f.why_level : null,
    sort_order: typeof f.sort_order === "number" ? f.sort_order : 0,
  }));

  const capaItems: RcaReportCapaItem[] = ((capaResult.data ?? []) as Array<Record<string, unknown>>).map((c) => ({
    title: String(c.title ?? ""),
    description: c.description ? String(c.description) : null,
    priority: String(c.priority ?? "medium"),
    status: String(c.status ?? "open"),
    assigned_to_name: resolveDisplayName(c.assignee),
    due_at: c.due_at ? String(c.due_at) : null,
    completed_at: c.completed_at ? String(c.completed_at) : null,
  }));

  const { bytes, filename } = await generateRcaReportPdf({
    session,
    action,
    messages,
    findings,
    capaItems,
  });

  return new Response(bytes, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
