import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";

export const runtime = "nodejs";

type RouteParams = { params: Promise<{ id: string }> };

const VALID_PRIORITIES = new Set(["low", "medium", "high", "critical"]);

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePriority(value: unknown): "low" | "medium" | "high" | "critical" {
  const normalized = clean(value).toLowerCase();
  return VALID_PRIORITIES.has(normalized)
    ? (normalized as "low" | "medium" | "high" | "critical")
    : "medium";
}

// GET /api/company/corrective-actions/[id]/rca/capa
// Lists CAPA items for the active RCA session
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
    .select("id, rca_session_id")
    .eq("id", actionId)
    .eq("company_id", companyScope.companyId)
    .eq("is_deleted", false)
    .maybeSingle();

  if (actionResult.error || !actionResult.data) {
    return NextResponse.json({ error: "Corrective action not found." }, { status: 404 });
  }

  const action = actionResult.data as { id: string; rca_session_id: string | null };
  if (!action.rca_session_id) {
    return NextResponse.json({ capaItems: [] });
  }

  const capaResult = await auth.supabase
    .from("ca_rca_capa_items")
    .select("id, title, description, priority, status, assigned_to, due_at, completed_at, created_at, updated_at")
    .eq("session_id", action.rca_session_id)
    .eq("company_id", companyScope.companyId)
    .order("created_at", { ascending: true });

  return NextResponse.json({ capaItems: capaResult.data ?? [] });
}

// POST /api/company/corrective-actions/[id]/rca/capa
// Adds a CAPA item to the active RCA session
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

  const body = (await request.json().catch(() => null)) as {
    title?: string;
    description?: string;
    priority?: string;
    assignedTo?: string;
    dueAt?: string;
  } | null;

  const title = clean(body?.title).slice(0, 160);
  if (!title) {
    return NextResponse.json({ error: "CAPA item title is required." }, { status: 400 });
  }

  const actionResult = await auth.supabase
    .from("company_corrective_actions")
    .select("id, rca_session_id")
    .eq("id", actionId)
    .eq("company_id", companyScope.companyId)
    .eq("is_deleted", false)
    .maybeSingle();

  if (actionResult.error || !actionResult.data) {
    return NextResponse.json({ error: "Corrective action not found." }, { status: 404 });
  }

  const action = actionResult.data as { id: string; rca_session_id: string | null };
  if (!action.rca_session_id) {
    return NextResponse.json({ error: "No RCA session exists for this corrective action." }, { status: 404 });
  }

  const dueAtRaw = clean(body?.dueAt);
  const dueAt = dueAtRaw ? new Date(dueAtRaw) : null;
  const dueAtIso =
    dueAt && !Number.isNaN(dueAt.getTime()) ? dueAt.toISOString() : null;

  const assignedToRaw = clean(body?.assignedTo);
  const assignedTo = assignedToRaw || null;

  const insertResult = await auth.supabase
    .from("ca_rca_capa_items")
    .insert({
      session_id: action.rca_session_id,
      company_id: companyScope.companyId,
      corrective_action_id: actionId,
      title,
      description: clean(body?.description).slice(0, 800) || null,
      priority: normalizePriority(body?.priority),
      status: "open",
      assigned_to: assignedTo,
      due_at: dueAtIso,
      created_by: auth.user.id,
    })
    .select("id, title, description, priority, status, assigned_to, due_at")
    .single();

  if (insertResult.error || !insertResult.data) {
    return NextResponse.json({ error: "Failed to create CAPA item." }, { status: 500 });
  }

  return NextResponse.json({ capaItem: insertResult.data }, { status: 201 });
}

// PATCH /api/company/corrective-actions/[id]/rca/capa
// Updates a CAPA item status (complete, in_progress, etc.)
export async function PATCH(request: Request, { params }: RouteParams) {
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

  const body = (await request.json().catch(() => null)) as {
    capaItemId?: string;
    status?: string;
    assignedTo?: string;
    dueAt?: string;
  } | null;

  const capaItemId = clean(body?.capaItemId);
  if (!capaItemId) {
    return NextResponse.json({ error: "capaItemId is required." }, { status: 400 });
  }

  const VALID_STATUSES = new Set(["open", "in_progress", "completed", "cancelled"]);
  const status = clean(body?.status).toLowerCase();

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (status && VALID_STATUSES.has(status)) {
    updates.status = status;
    if (status === "completed") {
      updates.completed_at = new Date().toISOString();
      updates.completed_by = auth.user.id;
    }
  }

  const assignedToRaw = clean(body?.assignedTo);
  if (assignedToRaw) updates.assigned_to = assignedToRaw;

  const dueAtRaw = clean(body?.dueAt);
  if (dueAtRaw) {
    const dueAt = new Date(dueAtRaw);
    if (!Number.isNaN(dueAt.getTime())) updates.due_at = dueAt.toISOString();
  }

  const updateResult = await auth.supabase
    .from("ca_rca_capa_items")
    .update(updates)
    .eq("id", capaItemId)
    .eq("company_id", companyScope.companyId)
    .eq("corrective_action_id", actionId)
    .select("id, title, status, completed_at")
    .single();

  if (updateResult.error || !updateResult.data) {
    return NextResponse.json({ error: "Failed to update CAPA item." }, { status: 500 });
  }

  return NextResponse.json({ capaItem: updateResult.data });
}
