import { NextResponse } from "next/server";
import { authorizeRequest, isAdminRole } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { getJobsiteAccessScope, isJobsiteAllowed } from "@/lib/jobsiteAccess";
import { blockIfCsepOnlyCompany } from "@/lib/csepApiGuard";

export const runtime = "nodejs";

const JSA_STATUSES = new Set(["draft", "submitted", "active", "closed"]);

function normalizeJsaStatus(input: unknown, fallback = "draft") {
  const value = String(input ?? "").trim().toLowerCase();
  if (value === "submitted") return "active";
  return JSA_STATUSES.has(value) ? value : fallback;
}

function isMissingTable(message?: string | null) {
  const lower = (message ?? "").toLowerCase();
  return lower.includes("company_jsas") || lower.includes("company_daps") || lower.includes("schema cache");
}

function canManage(role: string) {
  return (
    isAdminRole(role) ||
    role === "company_admin" ||
    role === "manager" ||
    role === "safety_manager" ||
    role === "project_manager" ||
    role === "foreman"
  );
}

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: [
      "can_create_documents",
      "can_view_all_company_data",
      "can_view_analytics",
      "can_view_dashboards",
    ],
  });
  if ("error" in auth) return auth.error;

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) return NextResponse.json({ jsas: [] });
  const csepBlockGet = await blockIfCsepOnlyCompany(auth.supabase, companyScope.companyId);
  if (csepBlockGet) return csepBlockGet;
  const jobsiteScope = await getJobsiteAccessScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    companyId: companyScope.companyId,
    role: auth.role,
  });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status")?.trim().toLowerCase();
  let query = auth.supabase
    .from("company_jsas")
    .select("*")
    .eq("company_id", companyScope.companyId)
    .order("updated_at", { ascending: false });
  if (status) query = query.eq("status", status);
  if (jobsiteScope.restricted) {
    if (jobsiteScope.jobsiteIds.length < 1) {
      return NextResponse.json({ jsas: [] });
    }
    query = query.in("jobsite_id", jobsiteScope.jobsiteIds);
  }

  const result = await query;
  if (result.error) {
    if (isMissingTable(result.error.message)) {
      return NextResponse.json(
        { jsas: [], warning: "JSA tables are not available yet. Run latest migrations." },
        { status: 200 }
      );
    }
    return NextResponse.json({ error: result.error.message || "Failed to load JSAs." }, { status: 500 });
  }

  return NextResponse.json({ jsas: result.data ?? [] });
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_create_documents", "can_view_all_company_data"],
  });
  if ("error" in auth) return auth.error;
  if (!canManage(auth.role)) {
    return NextResponse.json({ error: "Only company admins and managers can create JSAs." }, { status: 403 });
  }

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) {
    return NextResponse.json({ error: "This account is not linked to a company workspace yet." }, { status: 400 });
  }
  const csepBlockPost = await blockIfCsepOnlyCompany(auth.supabase, companyScope.companyId);
  if (csepBlockPost) return csepBlockPost;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const title = String(body?.title ?? "").trim();
  if (!title) return NextResponse.json({ error: "Title is required." }, { status: 400 });
  let jobsiteId = String(body?.jobsiteId ?? "").trim() || null;
  const jobsiteScope = await getJobsiteAccessScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    companyId: companyScope.companyId,
    role: auth.role,
  });
  if (jobsiteScope.restricted && !jobsiteId && jobsiteScope.jobsiteIds.length > 0) {
    jobsiteId = jobsiteScope.jobsiteIds[0] ?? null;
  }
  if (!isJobsiteAllowed(jobsiteId, jobsiteScope)) {
    return NextResponse.json(
      {
        error:
          jobsiteScope.restricted && jobsiteScope.jobsiteIds.length < 1
            ? "You need at least one jobsite assignment to create a JSA. Ask a company admin to assign you to a jobsite."
            : "You can only create JSAs for assigned jobsites.",
      },
      { status: 403 }
    );
  }

  const result = await auth.supabase
    .from("company_jsas")
    .insert({
      company_id: companyScope.companyId,
      jobsite_id: jobsiteId,
      title,
      description: String(body?.description ?? "").trim() || null,
      status: normalizeJsaStatus(body?.status, "draft"),
      severity: String(body?.severity ?? "").trim().toLowerCase() || "medium",
      category: String(body?.category ?? "").trim().toLowerCase() || "corrective_action",
      owner_user_id: String(body?.ownerUserId ?? "").trim() || null,
      due_at: String(body?.dueAt ?? "").trim() || null,
      created_by: auth.user.id,
      updated_by: auth.user.id,
    })
    .select("*")
    .single();

  if (result.error) {
    return NextResponse.json({ error: result.error.message || "Failed to create JSA." }, { status: 500 });
  }
  return NextResponse.json({ success: true, jsa: result.data });
}

export async function PATCH(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_edit_documents", "can_view_all_company_data"],
  });
  if ("error" in auth) return auth.error;
  if (!canManage(auth.role)) {
    return NextResponse.json({ error: "Only company admins and managers can update JSAs." }, { status: 403 });
  }

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) {
    return NextResponse.json({ error: "This account is not linked to a company workspace yet." }, { status: 400 });
  }
  const csepBlockPatch = await blockIfCsepOnlyCompany(auth.supabase, companyScope.companyId);
  if (csepBlockPatch) return csepBlockPatch;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const id = String(body?.id ?? "").trim();
  if (!id) return NextResponse.json({ error: "JSA id is required." }, { status: 400 });
  const existing = await auth.supabase
    .from("company_jsas")
    .select("id, jobsite_id")
    .eq("id", id)
    .eq("company_id", companyScope.companyId)
    .maybeSingle();
  if (existing.error) {
    return NextResponse.json({ error: existing.error.message || "Failed to load JSA." }, { status: 500 });
  }
  if (!existing.data) {
    return NextResponse.json({ error: "JSA not found." }, { status: 404 });
  }
  const targetJobsiteId =
    typeof body?.jobsiteId === "string" ? body.jobsiteId.trim() || null : existing.data.jobsite_id;
  const jobsiteScope = await getJobsiteAccessScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    companyId: companyScope.companyId,
    role: auth.role,
  });
  if (!isJobsiteAllowed(targetJobsiteId, jobsiteScope)) {
    return NextResponse.json(
      { error: "You can only update JSAs for assigned jobsites." },
      { status: 403 }
    );
  }

  const result = await auth.supabase
    .from("company_jsas")
    .update({
      ...(typeof body?.title === "string" ? { title: body.title.trim() } : {}),
      ...(typeof body?.description === "string" ? { description: body.description.trim() || null } : {}),
      ...(typeof body?.status === "string"
        ? { status: normalizeJsaStatus(body.status, "draft") }
        : {}),
      ...(typeof body?.severity === "string" ? { severity: body.severity.trim().toLowerCase() } : {}),
      ...(typeof body?.category === "string" ? { category: body.category.trim().toLowerCase() } : {}),
      ...(typeof body?.ownerUserId === "string" ? { owner_user_id: body.ownerUserId.trim() || null } : {}),
      ...(typeof body?.jobsiteId === "string" ? { jobsite_id: body.jobsiteId.trim() || null } : {}),
      ...(typeof body?.dueAt === "string" ? { due_at: body.dueAt.trim() || null } : {}),
      updated_by: auth.user.id,
    })
    .eq("id", id)
    .eq("company_id", companyScope.companyId)
    .select("*")
    .single();

  if (result.error) {
    return NextResponse.json({ error: result.error.message || "Failed to update JSA." }, { status: 500 });
  }

  const nextStatus = typeof body?.status === "string" ? normalizeJsaStatus(body.status, "draft") : null;
  if (nextStatus === "submitted") {
    const today = new Date().toISOString().slice(0, 10);
    await auth.supabase
      .from("company_jsa_activities")
      .update({
        work_date: today,
        status: "not_started",
        updated_by: auth.user.id,
      })
      .eq("company_id", companyScope.companyId)
      .eq("jsa_id", id);
  }

  return NextResponse.json({ success: true, jsa: result.data });
}
