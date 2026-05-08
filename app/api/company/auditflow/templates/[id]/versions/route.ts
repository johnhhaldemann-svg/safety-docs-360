import { NextResponse } from "next/server";
import { blockIfCsepOnlyCompany } from "@/lib/csepApiGuard";
import { getCompanyScope } from "@/lib/companyScope";
import { authorizeRequest } from "@/lib/rbac";
import {
  canManageAuditFlow,
  parseAuditFlowTemplateSchema,
} from "@/lib/auditflow/schema";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_create_documents", "can_view_all_company_data"],
  });
  if ("error" in auth) return auth.error;
  if (!canManageAuditFlow(auth.role)) {
    return NextResponse.json({ error: "Only company managers can version AuditFlow templates." }, { status: 403 });
  }

  const { id } = await context.params;
  const templateId = String(id ?? "").trim();
  if (!templateId) return NextResponse.json({ error: "Template id is required." }, { status: 400 });

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) return NextResponse.json({ error: "No company workspace." }, { status: 400 });

  const block = await blockIfCsepOnlyCompany(auth.supabase, companyScope.companyId);
  if (block) return block;

  const body = (await request.json().catch(() => null)) as { schema?: unknown } | null;
  const schema = parseAuditFlowTemplateSchema(body?.schema);
  if (schema.sections.length < 1) {
    return NextResponse.json({ error: "Template schema must include at least one section with items." }, { status: 400 });
  }

  const template = await auth.supabase
    .from("company_auditflow_templates")
    .select("id")
    .eq("company_id", companyScope.companyId)
    .eq("id", templateId)
    .maybeSingle();
  if (template.error) {
    return NextResponse.json({ error: template.error.message || "Failed to load template." }, { status: 500 });
  }
  if (!template.data) return NextResponse.json({ error: "Template not found." }, { status: 404 });

  const latest = await auth.supabase
    .from("company_auditflow_template_versions")
    .select("version")
    .eq("company_id", companyScope.companyId)
    .eq("template_id", templateId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextVersion = Number((latest.data as { version?: number } | null)?.version ?? 0) + 1;

  const insert = await auth.supabase
    .from("company_auditflow_template_versions")
    .insert({
      company_id: companyScope.companyId,
      template_id: templateId,
      version: nextVersion,
      schema,
      created_by: auth.user.id,
    })
    .select("*")
    .single();

  if (insert.error || !insert.data) {
    return NextResponse.json({ error: insert.error?.message || "Failed to create template version." }, { status: 500 });
  }

  await auth.supabase
    .from("company_auditflow_templates")
    .update({ current_version_id: insert.data.id, updated_by: auth.user.id })
    .eq("company_id", companyScope.companyId)
    .eq("id", templateId);

  return NextResponse.json({ success: true, version: insert.data });
}
