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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_create_documents", "can_view_all_company_data", "can_view_dashboards"],
  });
  if ("error" in auth) return auth.error;

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) return NextResponse.json({ versions: [] });

  const block = await blockIfCsepOnlyCompany(auth.supabase, companyScope.companyId);
  if (block) return block;

  const { id: definitionId } = await params;

  const def = await auth.supabase
    .from("company_safety_form_definitions")
    .select("id")
    .eq("id", definitionId)
    .eq("company_id", companyScope.companyId)
    .maybeSingle();

  if (def.error || !def.data) {
    return NextResponse.json({ versions: [] });
  }

  const res = await auth.supabase
    .from("company_safety_form_versions")
    .select("*")
    .eq("definition_id", definitionId)
    .order("version", { ascending: false });

  if (res.error) {
    return NextResponse.json({ versions: [], warning: res.error.message });
  }
  return NextResponse.json({ versions: res.data ?? [] });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_create_documents", "can_view_all_company_data"],
  });
  if ("error" in auth) return auth.error;
  if (!canManageForms(auth.role)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
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

  const { id: definitionId } = await params;

  const def = await auth.supabase
    .from("company_safety_form_definitions")
    .select("id")
    .eq("id", definitionId)
    .eq("company_id", companyScope.companyId)
    .maybeSingle();

  if (def.error || !def.data) {
    return NextResponse.json({ error: "Definition not found." }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const schema = parseSafetyFormSchema(body?.schema);
  if (!schema) {
    return NextResponse.json({ error: "schema with fields array is required." }, { status: 400 });
  }

  const maxRes = await auth.supabase
    .from("company_safety_form_versions")
    .select("version")
    .eq("definition_id", definitionId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = (maxRes.data?.version as number | undefined ?? 0) + 1;

  const ins = await auth.supabase
    .from("company_safety_form_versions")
    .insert({
      company_id: companyScope.companyId,
      definition_id: definitionId,
      version: nextVersion,
      schema,
      created_by: auth.user.id,
    })
    .select("*")
    .single();

  if (ins.error || !ins.data) {
    return NextResponse.json({ error: ins.error?.message || "Version create failed." }, { status: 500 });
  }

  return NextResponse.json({ version: ins.data });
}
