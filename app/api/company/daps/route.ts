import { NextResponse } from "next/server";
import { authorizeRequest, isAdminRole } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { getJobsiteAccessScope, isJobsiteAllowed } from "@/lib/jobsiteAccess";
import { blockIfCsepOnlyCompany } from "@/lib/csepApiGuard";

export const runtime = "nodejs";

const DAP_STATUSES = new Set(["draft", "submitted", "active", "closed"]);
function normalizeDapStatus(input: unknown, fallback = "draft") {
  const value = String(input ?? "").trim().toLowerCase();
  return DAP_STATUSES.has(value) ? value : fallback;
}

function isMissingTable(message?: string | null) {
  return (message ?? "").toLowerCase().includes("company_daps");
}
function isMissingCompatView(message?: string | null) {
  return (message ?? "").toLowerCase().includes("compat_company_daps");
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
  if (!companyScope.companyId) return NextResponse.json({ daps: [] });
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
    .from("compat_company_daps")
    .select("*")
    .eq("company_id", companyScope.companyId)
    .order("updated_at", { ascending: false });
  if (status) query = query.eq("status", status);
  if (jobsiteScope.restricted) {
    if (jobsiteScope.jobsiteIds.length < 1) {
      return NextResponse.json({ daps: [] });
    }
    query = query.in("jobsite_id", jobsiteScope.jobsiteIds);
  }

  let result = await query;
  if (result.error && isMissingCompatView(result.error.message)) {
    let fallbackQuery = auth.supabase
      .from("company_daps")
      .select("*")
      .eq("company_id", companyScope.companyId)
      .order("updated_at", { ascending: false });
    if (status) fallbackQuery = fallbackQuery.eq("status", status);
    if (jobsiteScope.restricted) {
      if (jobsiteScope.jobsiteIds.length < 1) {
        return NextResponse.json({ daps: [] });
      }
      fallbackQuery = fallbackQuery.in("jobsite_id", jobsiteScope.jobsiteIds);
    }
    result = await fallbackQuery;
  }
  if (result.error) {
    if (isMissingTable(result.error.message)) {
      return NextResponse.json(
        { daps: [], warning: "DAP tables are not available yet. Run latest migrations." },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: result.error.message || "Failed to load DAPs." }, { status: 500 });
  }

  return NextResponse.json({ daps: result.data ?? [] });
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_create_documents", "can_view_all_company_data"],
  });
  if ("error" in auth) return auth.error;
  if (!canManage(auth.role)) {
    return NextResponse.json({ error: "Only company admins and managers can create DAPs." }, { status: 403 });
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
  const jobsiteId = String(body?.jobsiteId ?? "").trim() || null;
  const jobsiteScope = await getJobsiteAccessScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    companyId: companyScope.companyId,
    role: auth.role,
  });
  if (!isJobsiteAllowed(jobsiteId, jobsiteScope)) {
    return NextResponse.json(
      { error: "You can only create DAPs for assigned jobsites." },
      { status: 403 }
    );
  }

  const result = await auth.supabase
    .from("company_daps")
    .insert({
      company_id: companyScope.companyId,
      jobsite_id: jobsiteId,
      title,
      description: String(body?.description ?? "").trim() || null,
      status: normalizeDapStatus(body?.status, "draft"),
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
    return NextResponse.json({ error: result.error.message || "Failed to create DAP." }, { status: 500 });
  }
  return NextResponse.json({ success: true, dap: result.data });
}

export async function PATCH(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_edit_documents", "can_view_all_company_data"],
  });
  if ("error" in auth) return auth.error;
  if (!canManage(auth.role)) {
    return NextResponse.json({ error: "Only company admins and managers can update DAPs." }, { status: 403 });
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
  if (!id) return NextResponse.json({ error: "DAP id is required." }, { status: 400 });
  const existing = await auth.supabase
    .from("company_daps")
    .select("id, jobsite_id")
    .eq("id", id)
    .eq("company_id", companyScope.companyId)
    .maybeSingle();
  if (existing.error) {
    return NextResponse.json({ error: existing.error.message || "Failed to load DAP." }, { status: 500 });
  }
  if (!existing.data) {
    return NextResponse.json({ error: "DAP not found." }, { status: 404 });
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
      { error: "You can only update DAPs for assigned jobsites." },
      { status: 403 }
    );
  }

  const result = await auth.supabase
    .from("company_daps")
    .update({
      ...(typeof body?.title === "string" ? { title: body.title.trim() } : {}),
      ...(typeof body?.description === "string" ? { description: body.description.trim() || null } : {}),
      ...(typeof body?.status === "string"
        ? { status: normalizeDapStatus(body.status, "draft") }
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
    return NextResponse.json({ error: result.error.message || "Failed to update DAP." }, { status: 500 });
  }

  const nextStatus = typeof body?.status === "string" ? normalizeDapStatus(body.status, "draft") : null;
  if (nextStatus === "submitted") {
    const today = new Date().toISOString().slice(0, 10);
    await auth.supabase
      .from("company_dap_activities")
      .update({
        work_date: today,
        status: "not_started",
        updated_by: auth.user.id,
      })
      .eq("company_id", companyScope.companyId)
      .eq("dap_id", id);
  }

  return NextResponse.json({ success: true, dap: result.data });
}
