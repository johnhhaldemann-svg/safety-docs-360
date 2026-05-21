import { NextResponse } from "next/server";
import { blockIfCsepOnlyCompany } from "@/lib/csepApiGuard";
import { getCompanyScope } from "@/lib/companyScope";
import { authorizeRequest } from "@/lib/rbac";
import { canManageAuditFlow } from "@/lib/auditflow/schema";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_create_documents", "can_view_all_company_data"],
  });
  if ("error" in auth) return auth.error;
  if (!canManageAuditFlow(auth.role)) {
    return NextResponse.json({ error: "Only company managers can update AuditFlow templates." }, { status: 403 });
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

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const patch: Record<string, unknown> = { updated_by: auth.user.id };
  if (typeof body?.title === "string") {
    const title = body.title.trim();
    if (!title) return NextResponse.json({ error: "Template title cannot be empty." }, { status: 400 });
    patch.title = title;
  }
  if (typeof body?.description === "string") patch.description = body.description.trim() || null;
  if (typeof body?.active === "boolean") patch.active = body.active;

  if (Object.keys(patch).length <= 1) {
    return NextResponse.json({ error: "No supported template fields provided." }, { status: 400 });
  }

  const result = await auth.supabase
    .from("company_auditflow_templates")
    .update(patch)
    .eq("company_id", companyScope.companyId)
    .eq("id", templateId)
    .select("*")
    .single();

  if (result.error) {
    return NextResponse.json({ error: result.error.message || "Failed to update AuditFlow template." }, { status: 500 });
  }

  return NextResponse.json({ success: true, template: result.data });
}
