import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { getJobsiteAccessScope, isJobsiteAllowed } from "@/lib/jobsiteAccess";
import { canManageIncidents, canManageObservations } from "@/lib/companyPermissions";

export const runtime = "nodejs";

const VALID_STATUSES = new Set([
  "open",
  "assigned",
  "in_progress",
  "corrected",
  "verified_closed",
  "escalated",
  "stop_work",
]);

function normalizeStatus(input: unknown, fallback = "open") {
  const value = String(input ?? "").trim().toLowerCase();
  return VALID_STATUSES.has(value) ? value : fallback;
}

async function loadScopedObservation({
  request,
  id,
}: {
  request: Request;
  id: string;
}) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: [
      "can_view_all_company_data",
      "can_view_dashboards",
      "can_view_analytics",
      "can_create_documents",
    ],
  });
  if ("error" in auth) return auth;
  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) return { ...auth, companyId: null, row: null };
  const row = await auth.supabase
    .from("company_corrective_actions")
    .select("*")
    .eq("id", id)
    .eq("company_id", companyScope.companyId)
    .maybeSingle();
  if (row.error) {
    return { ...auth, companyId: companyScope.companyId, rowError: row.error.message, row: null };
  }
  return { ...auth, companyId: companyScope.companyId, row: row.data };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const scoped = await loadScopedObservation({ request, id });
  if ("error" in scoped) return scoped.error;
  if (!("row" in scoped)) {
    return NextResponse.json({ error: "Unable to load observation scope." }, { status: 500 });
  }
  if ("rowError" in scoped && scoped.rowError) {
    return NextResponse.json({ error: scoped.rowError }, { status: 500 });
  }
  if (!scoped.row) return NextResponse.json({ error: "Observation not found." }, { status: 404 });
  const jobsiteScope = await getJobsiteAccessScope({
    supabase: scoped.supabase,
    userId: scoped.user.id,
    companyId: scoped.companyId!,
    role: scoped.role,
  });
  if (!isJobsiteAllowed(scoped.row.jobsite_id, jobsiteScope)) {
    return NextResponse.json({ error: "Observation access denied." }, { status: 403 });
  }
  return NextResponse.json({ observation: scoped.row });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const scoped = await loadScopedObservation({ request, id });
  if ("error" in scoped) return scoped.error;
  if (!("row" in scoped)) {
    return NextResponse.json({ error: "Unable to load observation scope." }, { status: 500 });
  }
  if (!canManageObservations(scoped.role)) {
    return NextResponse.json({ error: "You do not have permission to update observations." }, { status: 403 });
  }
  if ("rowError" in scoped && scoped.rowError) {
    return NextResponse.json({ error: scoped.rowError }, { status: 500 });
  }
  if (!scoped.row) return NextResponse.json({ error: "Observation not found." }, { status: 404 });
  const jobsiteScope = await getJobsiteAccessScope({
    supabase: scoped.supabase,
    userId: scoped.user.id,
    companyId: scoped.companyId!,
    role: scoped.role,
  });
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const targetJobsiteId =
    typeof body?.jobsiteId === "string" ? body.jobsiteId.trim() || null : scoped.row.jobsite_id;
  if (!isJobsiteAllowed(targetJobsiteId, jobsiteScope)) {
    return NextResponse.json({ error: "Observation jobsite access denied." }, { status: 403 });
  }
  const nextStatus =
    typeof body?.status === "string"
      ? normalizeStatus(body.status)
      : typeof body?.workflowStatus === "string"
        ? normalizeStatus(body.workflowStatus)
        : null;
  const result = await scoped.supabase
    .from("company_corrective_actions")
    .update({
      ...(typeof body?.title === "string" ? { title: body.title.trim() } : {}),
      ...(typeof body?.description === "string" ? { description: body.description.trim() || null } : {}),
      ...(nextStatus ? { status: nextStatus } : {}),
      ...(typeof body?.severity === "string" ? { severity: body.severity.trim().toLowerCase() } : {}),
      ...(typeof body?.category === "string" ? { category: body.category.trim().toLowerCase() } : {}),
      ...(typeof body?.dueAt === "string" ? { due_at: body.dueAt.trim() || null } : {}),
      ...(typeof body?.jobsiteId === "string" ? { jobsite_id: body.jobsiteId.trim() || null } : {}),
      ...(typeof body?.dapActivityId === "string" ? { dap_activity_id: body.dapActivityId.trim() || null } : {}),
      updated_by: scoped.user.id,
    })
    .eq("id", id)
    .eq("company_id", scoped.companyId!)
    .select("*")
    .single();
  if (result.error) {
    return NextResponse.json({ error: result.error.message || "Failed to update observation." }, { status: 500 });
  }
  if (body?.convertToIncident === true) {
    if (!canManageIncidents(scoped.role)) {
      return NextResponse.json({ error: "You do not have permission to create incidents." }, { status: 403 });
    }
    const incidentType = String(body?.incidentType ?? "").trim().toLowerCase() || "incident";
    const incidentResult = await scoped.supabase
      .from("company_incidents")
      .insert({
        company_id: scoped.companyId!,
        jobsite_id: result.data.jobsite_id ?? null,
        observation_id: id,
        incident_type: incidentType,
        category: incidentType,
        severity: result.data.severity ?? "medium",
        title: result.data.title ?? "Escalated Observation",
        description: result.data.description ?? null,
        status: "open",
        reported_by: scoped.user.id,
        reported_at: new Date().toISOString(),
        created_by: scoped.user.id,
        updated_by: scoped.user.id,
      })
      .select("*")
      .single();
    if (incidentResult.error) {
      return NextResponse.json(
        { error: incidentResult.error.message || "Observation updated but failed to create incident." },
        { status: 500 }
      );
    }
    return NextResponse.json({ success: true, observation: result.data, incident: incidentResult.data });
  }
  return NextResponse.json({ success: true, observation: result.data });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const scoped = await loadScopedObservation({ request, id });
  if ("error" in scoped) return scoped.error;
  if (!("row" in scoped)) {
    return NextResponse.json({ error: "Unable to load observation scope." }, { status: 500 });
  }
  if (!canManageObservations(scoped.role)) {
    return NextResponse.json({ error: "You do not have permission to delete observations." }, { status: 403 });
  }
  if ("rowError" in scoped && scoped.rowError) {
    return NextResponse.json({ error: scoped.rowError }, { status: 500 });
  }
  if (!scoped.row) return NextResponse.json({ error: "Observation not found." }, { status: 404 });
  const result = await scoped.supabase
    .from("company_corrective_actions")
    .delete()
    .eq("id", id)
    .eq("company_id", scoped.companyId!);
  if (result.error) {
    return NextResponse.json({ error: result.error.message || "Failed to delete observation." }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
