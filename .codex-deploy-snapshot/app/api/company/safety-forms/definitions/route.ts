import { NextResponse } from "next/server";
import { authorizeRequest, isAdminRole } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { blockIfCsepOnlyCompany } from "@/lib/csepApiGuard";
import { parseSafetyFormSchema } from "@/lib/safetyForms/schema";

export const runtime = "nodejs";

function canManageForms(role: string) {
  return (
    isAdminRole(role) ||
    role === "company_admin" ||
    role === "manager" ||
    role === "safety_manager" ||
    role === "project_manager"
  );
}

const DEMO_FORM_DEFINITIONS = [
  { id: "demo-form-def-1", title: "Daily Pre-Task Safety Check", active: true },
  { id: "demo-form-def-2", title: "Hot Work Readiness Card", active: true },
  { id: "demo-form-def-3", title: "Supervisor Walkthrough Checklist", active: true },
];

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_create_documents", "can_view_all_company_data", "can_view_dashboards"],
  });
  if ("error" in auth) return auth.error;
  if (auth.role === "sales_demo") {
    return NextResponse.json({ definitions: DEMO_FORM_DEFINITIONS });
  }

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) return NextResponse.json({ definitions: [] });

  const block = await blockIfCsepOnlyCompany(auth.supabase, companyScope.companyId);
  if (block) return block;

  const res = await auth.supabase
    .from("company_safety_form_definitions")
    .select("*")
    .eq("company_id", companyScope.companyId)
    .order("title", { ascending: true });

  if (res.error) {
    return NextResponse.json({ definitions: [], warning: res.error.message });
  }
  return NextResponse.json({ definitions: res.data ?? [] });
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_create_documents", "can_view_all_company_data"],
  });
  if ("error" in auth) return auth.error;
  if (!canManageForms(auth.role)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  if (auth.role === "sales_demo") {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const title = String(body?.title ?? "").trim() || "Demo safety form";
    const schema = parseSafetyFormSchema(body?.initialSchema) ?? { fields: [] };
    return NextResponse.json({
      definition: {
        id: `demo-form-def-${Date.now()}`,
        company_id: "demo-company",
        title,
        active: body?.active !== false,
      },
      version: {
        id: `demo-form-ver-${Date.now()}`,
        definition_id: "demo-form-def-new",
        version: 1,
        schema,
      },
    });
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
  const title = String(body?.title ?? "").trim();
  if (!title) return NextResponse.json({ error: "title is required." }, { status: 400 });

  const defIns = await auth.supabase
    .from("company_safety_form_definitions")
    .insert({
      company_id: companyScope.companyId,
      title,
      active: body?.active !== false,
      created_by: auth.user.id,
    })
    .select("*")
    .single();

  if (defIns.error || !defIns.data) {
    return NextResponse.json({ error: defIns.error?.message || "Create failed." }, { status: 500 });
  }

  const schema = parseSafetyFormSchema(body?.initialSchema) ?? { fields: [] };
  const verIns = await auth.supabase
    .from("company_safety_form_versions")
    .insert({
      company_id: companyScope.companyId,
      definition_id: defIns.data.id,
      version: 1,
      schema,
      created_by: auth.user.id,
    })
    .select("*")
    .single();

  if (verIns.error) {
    return NextResponse.json({ error: verIns.error.message || "Version create failed." }, { status: 500 });
  }

  return NextResponse.json({ definition: defIns.data, version: verIns.data });
}
