import { NextResponse } from "next/server";
import { authorizeRequest, isAdminRole } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { blockIfCsepOnlyCompany } from "@/lib/csepApiGuard";

export const runtime = "nodejs";

function canManageTemplates(role: string) {
  return (
    isAdminRole(role) ||
    role === "company_admin" ||
    role === "manager" ||
    role === "safety_manager"
  );
}

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: [
      "can_view_all_company_data",
      "can_view_dashboards",
      "can_create_documents",
    ],
  });
  if ("error" in auth) return auth.error;

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) return NextResponse.json({ templates: [] });

  const block = await blockIfCsepOnlyCompany(auth.supabase, companyScope.companyId);
  if (block) return block;

  const res = await auth.supabase
    .from("company_toolbox_templates")
    .select("*")
    .eq("company_id", companyScope.companyId)
    .order("name", { ascending: true });

  if (res.error) {
    return NextResponse.json({ templates: [], warning: res.error.message });
  }
  return NextResponse.json({ templates: res.data ?? [] });
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_manage_company_users", "can_view_all_company_data"],
  });
  if ("error" in auth) return auth.error;
  if (!canManageTemplates(auth.role)) {
    return NextResponse.json({ error: "Only managers can create toolbox templates." }, { status: 403 });
  }

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) {
    return NextResponse.json({ error: "No company workspace." }, { status: 400 });
  }

  const block = await blockIfCsepOnlyCompany(auth.supabase, companyScope.companyId);
  if (block) return block;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const name = String(body?.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "name is required." }, { status: 400 });
  const topics = Array.isArray(body?.topics) ? body!.topics : [];
  const tradeTags = Array.isArray(body?.tradeTags) ? body!.tradeTags : [];

  const ins = await auth.supabase
    .from("company_toolbox_templates")
    .insert({
      company_id: companyScope.companyId,
      name,
      topics,
      trade_tags: tradeTags,
      active: body?.active === false ? false : true,
      created_by: auth.user.id,
    })
    .select("*")
    .single();

  if (ins.error) {
    return NextResponse.json({ error: ins.error.message || "Failed to create template." }, { status: 500 });
  }
  return NextResponse.json({ template: ins.data });
}
