import { NextResponse } from "next/server";
import { authorizeRequest, isAdminRole } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { blockIfCsepOnlyCompany } from "@/lib/csepApiGuard";

export const runtime = "nodejs";

function canConfigureInductions(role: string) {
  return (
    isAdminRole(role) ||
    role === "company_admin" ||
    role === "manager" ||
    role === "safety_manager"
  );
}

function isMissingInductionTable(message?: string | null) {
  const m = (message ?? "").toLowerCase();
  return m.includes("company_induction_programs");
}

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: [
      "can_view_all_company_data",
      "can_view_analytics",
      "can_view_dashboards",
      "can_manage_company_users",
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
  if (!companyScope.companyId) {
    return NextResponse.json({ programs: [] });
  }

  const block = await blockIfCsepOnlyCompany(auth.supabase, companyScope.companyId);
  if (block) return block;

  const res = await auth.supabase
    .from("company_induction_programs")
    .select("id, company_id, name, description, audience, required_docs, active, created_at, updated_at")
    .eq("company_id", companyScope.companyId)
    .order("name", { ascending: true });

  if (res.error) {
    if (isMissingInductionTable(res.error.message)) {
      return NextResponse.json({ programs: [], warning: "Induction tables not migrated yet." });
    }
    return NextResponse.json({ error: res.error.message || "Failed to load programs." }, { status: 500 });
  }

  return NextResponse.json({ programs: res.data ?? [] });
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_manage_company_users", "can_view_all_company_data"],
  });
  if ("error" in auth) return auth.error;
  if (!canConfigureInductions(auth.role)) {
    return NextResponse.json({ error: "Only admins and managers can create induction programs." }, { status: 403 });
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

  const block = await blockIfCsepOnlyCompany(auth.supabase, companyScope.companyId);
  if (block) return block;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const name = String(body?.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "name is required." }, { status: 400 });
  }
  const description = String(body?.description ?? "").trim() || null;
  const audienceRaw = String(body?.audience ?? "worker").trim().toLowerCase();
  const audience =
    audienceRaw === "visitor" || audienceRaw === "subcontractor" ? audienceRaw : "worker";
  const requiredDocs = Array.isArray(body?.requiredDocs) ? body!.requiredDocs : [];

  const ins = await auth.supabase
    .from("company_induction_programs")
    .insert({
      company_id: companyScope.companyId,
      name,
      description,
      audience,
      required_docs: requiredDocs,
      active: body?.active === false ? false : true,
      created_by: auth.user.id,
      updated_by: auth.user.id,
    })
    .select("*")
    .single();

  if (ins.error) {
    if (isMissingInductionTable(ins.error.message)) {
      return NextResponse.json({ error: "Induction tables not available. Run migrations." }, { status: 503 });
    }
    return NextResponse.json({ error: ins.error.message || "Failed to create program." }, { status: 500 });
  }

  return NextResponse.json({ program: ins.data });
}
