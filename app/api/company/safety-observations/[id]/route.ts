import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { getJobsiteAccessScope, isJobsiteAllowed } from "@/lib/jobsiteAccess";
import { canManageObservations } from "@/lib/companyPermissions";
import { isValidObservationCombo } from "@/lib/safety-observations/tree";
import { OBSERVATION_TYPES, SEVERITY_OPTIONS, STATUS_OPTIONS } from "@/lib/safety-observations/constants";

export const runtime = "nodejs";

const LIST_SELECT =
  "id,company_id,jobsite_id,project_id,title,description,observation_type,category,subcategory,severity,status,trade,location,assigned_to,created_by,closed_by,due_date,closed_at,photo_urls,tags,corrective_action,immediate_action_taken,created_at,updated_at";

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_create_documents", "can_view_all_company_data"],
  });
  if ("error" in auth) return auth.error;
  if (!canManageObservations(auth.role)) {
    return NextResponse.json({ error: "You do not have permission to update safety observations." }, { status: 403 });
  }

  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
  });
  if (!companyScope.companyId) {
    return NextResponse.json({ error: "No company scope found." }, { status: 400 });
  }

  const existing = await auth.supabase
    .from("safety_observations")
    .select("id,company_id,jobsite_id,observation_type,category,subcategory,status")
    .eq("id", id)
    .eq("company_id", companyScope.companyId)
    .maybeSingle();

  if (existing.error || !existing.data) {
    return NextResponse.json({ error: "Observation not found." }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid body." }, { status: 400 });

  const jobsiteScope = await getJobsiteAccessScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    companyId: companyScope.companyId,
    role: auth.role,
  });

  const patch: Record<string, unknown> = {};

  if (body.title !== undefined) {
    const t = String(body.title ?? "").trim();
    if (!t) return NextResponse.json({ error: "title cannot be empty." }, { status: 400 });
    patch.title = t;
  }
  if (body.description !== undefined) patch.description = String(body.description ?? "").trim() || null;
  if (body.location !== undefined) patch.location = String(body.location ?? "").trim() || null;
  if (body.trade !== undefined) patch.trade = String(body.trade ?? "").trim() || null;
  if (body.immediate_action_taken !== undefined || body.immediateActionTaken !== undefined) {
    patch.immediate_action_taken = String(
      body.immediate_action_taken ?? body.immediateActionTaken ?? ""
    ).trim() || null;
  }
  if (body.corrective_action !== undefined || body.correctiveAction !== undefined) {
    patch.corrective_action = String(body.corrective_action ?? body.correctiveAction ?? "").trim() || null;
  }

  let nextType = String(existing.data.observation_type);
  let nextCategory = String(existing.data.category);
  let nextSubcategory = String(existing.data.subcategory);

  if (body.observation_type !== undefined) {
    const v = String(body.observation_type ?? "").trim();
    if (!OBSERVATION_TYPES.includes(v as (typeof OBSERVATION_TYPES)[number])) {
      return NextResponse.json({ error: "Invalid observation_type." }, { status: 400 });
    }
    nextType = v;
    patch.observation_type = v;
  }
  if (body.category !== undefined) {
    nextCategory = String(body.category ?? "").trim();
    patch.category = nextCategory;
  }
  if (body.subcategory !== undefined) {
    nextSubcategory = String(body.subcategory ?? "").trim();
    patch.subcategory = nextSubcategory;
  }
  if (
    body.observation_type !== undefined ||
    body.category !== undefined ||
    body.subcategory !== undefined
  ) {
    if (!isValidObservationCombo(nextType, nextCategory, nextSubcategory)) {
      return NextResponse.json({ error: "category and subcategory do not match observation_type." }, { status: 400 });
    }
  }

  if (body.severity !== undefined) {
    const v = String(body.severity ?? "").trim();
    if (!SEVERITY_OPTIONS.includes(v as (typeof SEVERITY_OPTIONS)[number])) {
      return NextResponse.json({ error: "Invalid severity." }, { status: 400 });
    }
    patch.severity = v;
  }

  if (body.status !== undefined) {
    const v = String(body.status ?? "").trim();
    if (!STATUS_OPTIONS.includes(v as (typeof STATUS_OPTIONS)[number])) {
      return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    }
    patch.status = v;
    if (v === "Closed") {
      patch.closed_at = new Date().toISOString();
      patch.closed_by = auth.user.id;
    } else {
      patch.closed_at = null;
      patch.closed_by = null;
    }
  }

  if (body.jobsite_id !== undefined || body.jobsiteId !== undefined) {
    const raw = body.jobsite_id ?? body.jobsiteId;
    const jobsite_id =
      raw === null || raw === "" ? null : String(raw).trim() || null;
    if (!isJobsiteAllowed(jobsite_id, jobsiteScope)) {
      return NextResponse.json({ error: "Jobsite access denied." }, { status: 403 });
    }
    patch.jobsite_id = jobsite_id;
  }

  if (body.assigned_to !== undefined || body.assignedTo !== undefined) {
    const raw = body.assigned_to ?? body.assignedTo;
    patch.assigned_to =
      raw === null || raw === "" ? null : String(raw).trim() || null;
  }

  if (body.due_date !== undefined || body.dueDate !== undefined) {
    const raw = body.due_date ?? body.dueDate;
    patch.due_date =
      raw === null || raw === "" ? null : String(raw).trim().slice(0, 10) || null;
  }

  if (body.photo_urls !== undefined || body.photoUrls !== undefined) {
    const raw = body.photo_urls ?? body.photoUrls;
    patch.photo_urls = Array.isArray(raw)
      ? raw.filter((u): u is string => typeof u === "string" && u.length > 0)
      : [];
  }

  if (Object.keys(patch).length < 1) {
    return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
  }

  const prevStatus = String(existing.data.status);
  const upd = await auth.supabase.from("safety_observations").update(patch).eq("id", id).select(LIST_SELECT).single();
  if (upd.error) {
    return NextResponse.json({ error: upd.error.message || "Update failed." }, { status: 500 });
  }

  const newStatus = String((upd.data as { status?: string }).status ?? "");
  if (newStatus !== prevStatus) {
    await auth.supabase.from("safety_observation_updates").insert({
      observation_id: id,
      update_type: "Status Change",
      message: `Status changed from ${prevStatus} to ${newStatus}.`,
      created_by: auth.user.id,
    });
  }

  return NextResponse.json({ observation: upd.data });
}
