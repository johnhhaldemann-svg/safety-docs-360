import { NextResponse } from "next/server";
import { authorizeRequest, isAdminRole } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";

export const runtime = "nodejs";

function isMissingCrewsTable(message?: string | null) {
  return (message ?? "").toLowerCase().includes("company_crews");
}

function canManage(role: string) {
  return isAdminRole(role) || role === "company_admin" || role === "manager" || role === "safety_manager";
}

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: [
      "can_view_all_company_data",
      "can_view_analytics",
      "can_view_dashboards",
      "can_manage_company_users",
    ],
  });
  if ("error" in auth) return auth.error;

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) {
    return NextResponse.json({ crews: [] });
  }

  const { searchParams } = new URL(request.url);
  const jobsiteId = String(searchParams.get("jobsiteId") ?? "").trim() || null;

  let query = auth.supabase
    .from("company_crews")
    .select("id, name, jobsite_id, active")
    .eq("company_id", companyScope.companyId)
    .eq("active", true)
    .order("name", { ascending: true });

  if (jobsiteId) {
    query = query.or(`jobsite_id.is.null,jobsite_id.eq.${jobsiteId}`);
  }

  const res = await query;

  if (res.error) {
    if (isMissingCrewsTable(res.error.message)) {
      return NextResponse.json({ crews: [], warning: "Crews table not migrated yet." });
    }
    return NextResponse.json({ error: res.error.message || "Failed to load crews." }, { status: 500 });
  }

  const crews = (res.data ?? []).map((row) => {
    const r = row as { id: string; name: string; jobsite_id?: string | null };
    const label =
      r.jobsite_id != null && r.jobsite_id !== ""
        ? `${String(r.name ?? "").trim() || "Crew"} (site)`
        : String(r.name ?? "").trim() || "Crew";
    return {
      id: String(r.id),
      name: label,
      jobsiteId: r.jobsite_id ?? null,
    };
  });

  return NextResponse.json({ crews });
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_manage_company_users", "can_view_all_company_data"],
  });
  if ("error" in auth) return auth.error;
  if (!canManage(auth.role)) {
    return NextResponse.json({ error: "Only admins and managers can add crews." }, { status: 403 });
  }

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) {
    return NextResponse.json({ error: "No company workspace linked." }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const name = String(body?.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "name is required." }, { status: 400 });
  }

  const notes = String(body?.notes ?? "").trim() || null;
  const jobsiteId = String(body?.jobsiteId ?? "").trim() || null;

  if (jobsiteId) {
    const js = await auth.supabase
      .from("company_jobsites")
      .select("id")
      .eq("company_id", companyScope.companyId)
      .eq("id", jobsiteId)
      .maybeSingle();
    if (js.error || !js.data?.id) {
      return NextResponse.json({ error: "jobsiteId must belong to your company." }, { status: 400 });
    }
  }

  const ins = await auth.supabase
    .from("company_crews")
    .insert({
      company_id: companyScope.companyId,
      jobsite_id: jobsiteId,
      name,
      notes,
      active: true,
      created_by: auth.user.id,
    })
    .select("id, name, jobsite_id, active")
    .single();

  if (ins.error) {
    if (isMissingCrewsTable(ins.error.message)) {
      return NextResponse.json({ error: "Crews table not available. Run migrations." }, { status: 503 });
    }
    return NextResponse.json({ error: ins.error.message || "Failed to create crew." }, { status: 500 });
  }

  return NextResponse.json({ crew: ins.data });
}
