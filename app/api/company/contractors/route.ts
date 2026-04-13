import { NextResponse } from "next/server";
import { authorizeRequest, isAdminRole } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";

export const runtime = "nodejs";

function isMissingContractorsTable(message?: string | null) {
  return (message ?? "").toLowerCase().includes("company_contractors");
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
    return NextResponse.json({ contractors: [] });
  }

  const res = await auth.supabase
    .from("company_contractors")
    .select("id, name, active")
    .eq("company_id", companyScope.companyId)
    .eq("active", true)
    .order("name", { ascending: true });

  if (res.error) {
    if (isMissingContractorsTable(res.error.message)) {
      return NextResponse.json({ contractors: [], warning: "Contractors table not migrated yet." });
    }
    return NextResponse.json({ error: res.error.message || "Failed to load contractors." }, { status: 500 });
  }

  const contractors = (res.data ?? []).map((row) => ({
    id: String((row as { id: string }).id),
    name: String((row as { name: string }).name ?? "").trim() || "Unnamed",
  }));

  return NextResponse.json({ contractors });
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_manage_company_users", "can_view_all_company_data"],
  });
  if ("error" in auth) return auth.error;
  if (!canManage(auth.role)) {
    return NextResponse.json({ error: "Only admins and managers can add contractors." }, { status: 403 });
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

  const ins = await auth.supabase
    .from("company_contractors")
    .insert({
      company_id: companyScope.companyId,
      name,
      notes,
      active: true,
      created_by: auth.user.id,
    })
    .select("id, name, active")
    .single();

  if (ins.error) {
    if (isMissingContractorsTable(ins.error.message)) {
      return NextResponse.json({ error: "Contractors table not available. Run migrations." }, { status: 503 });
    }
    return NextResponse.json({ error: ins.error.message || "Failed to create contractor." }, { status: 500 });
  }

  return NextResponse.json({ contractor: ins.data });
}
