import { NextResponse } from "next/server";
import { blockIfCsepOnlyCompany } from "@/lib/csepApiGuard";
import { getCompanyScope } from "@/lib/companyScope";
import { authorizeRequest } from "@/lib/rbac";
import {
  canManageAuditFlow,
  parseAuditFlowTemplateSchema,
} from "@/lib/auditflow/schema";

export const runtime = "nodejs";

type TemplateBody = {
  title?: string;
  description?: string | null;
  active?: boolean;
  schema?: unknown;
};

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: [
      "can_access_field_audits",
      "can_view_dashboards",
      "can_submit_documents",
      "can_view_all_company_data",
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

  const templates = await auth.supabase
    .from("company_auditflow_templates")
    .select("*")
    .eq("company_id", companyScope.companyId)
    .order("updated_at", { ascending: false });

  if (templates.error) {
    return NextResponse.json(
      { error: templates.error.message || "Failed to load AuditFlow templates." },
      { status: 500 }
    );
  }

  const templateIds = (templates.data ?? []).map((row) => row.id).filter(Boolean);
  let versionsByTemplateId: Record<string, unknown[]> = {};
  if (templateIds.length > 0) {
    const versions = await auth.supabase
      .from("company_auditflow_template_versions")
      .select("*")
      .eq("company_id", companyScope.companyId)
      .in("template_id", templateIds)
      .order("version", { ascending: false });
    if (!versions.error) {
      versionsByTemplateId = ((versions.data as Array<Record<string, unknown>> | null) ?? []).reduce<
        Record<string, unknown[]>
      >((acc, row) => {
        const templateId = String(row.template_id ?? "");
        if (!templateId) return acc;
        acc[templateId] = acc[templateId] ? [...acc[templateId], row] : [row];
        return acc;
      }, {});
    }
  }

  return NextResponse.json({
    templates: (templates.data ?? []).map((template) => ({
      ...template,
      versions: versionsByTemplateId[template.id] ?? [],
    })),
    scopeCompanyId: companyScope.companyId,
    canManage: canManageAuditFlow(auth.role),
  });
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_create_documents", "can_view_all_company_data"],
  });
  if ("error" in auth) return auth.error;
  if (!canManageAuditFlow(auth.role)) {
    return NextResponse.json({ error: "Only company managers can create AuditFlow templates." }, { status: 403 });
  }

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) return NextResponse.json({ error: "No company workspace." }, { status: 400 });

  const block = await blockIfCsepOnlyCompany(auth.supabase, companyScope.companyId);
  if (block) return block;

  const body = (await request.json().catch(() => null)) as TemplateBody | null;
  const title = String(body?.title ?? "").trim();
  const description = String(body?.description ?? "").trim();
  const schema = parseAuditFlowTemplateSchema(body?.schema);

  if (!title) return NextResponse.json({ error: "Template title is required." }, { status: 400 });
  if (schema.sections.length < 1) {
    return NextResponse.json({ error: "Template schema must include at least one section with items." }, { status: 400 });
  }

  const templateInsert = await auth.supabase
    .from("company_auditflow_templates")
    .insert({
      company_id: companyScope.companyId,
      title,
      description: description || null,
      active: body?.active !== false,
      created_by: auth.user.id,
      updated_by: auth.user.id,
    })
    .select("*")
    .single();

  if (templateInsert.error || !templateInsert.data) {
    return NextResponse.json(
      { error: templateInsert.error?.message || "Failed to create AuditFlow template." },
      { status: 500 }
    );
  }

  const versionInsert = await auth.supabase
    .from("company_auditflow_template_versions")
    .insert({
      company_id: companyScope.companyId,
      template_id: templateInsert.data.id,
      version: 1,
      schema,
      created_by: auth.user.id,
    })
    .select("*")
    .single();

  if (versionInsert.error || !versionInsert.data) {
    return NextResponse.json(
      { error: versionInsert.error?.message || "Template created, but version creation failed." },
      { status: 500 }
    );
  }

  const templateUpdate = await auth.supabase
    .from("company_auditflow_templates")
    .update({ current_version_id: versionInsert.data.id, updated_by: auth.user.id })
    .eq("company_id", companyScope.companyId)
    .eq("id", templateInsert.data.id)
    .select("*")
    .single();

  return NextResponse.json({
    success: true,
    template: templateUpdate.data ?? templateInsert.data,
    version: versionInsert.data,
    warning: templateUpdate.error?.message ?? null,
  });
}
