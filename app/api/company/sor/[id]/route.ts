import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { computeSorHash } from "@/lib/sor/hash";

export const runtime = "nodejs";

const SOR_SELECT =
  "id, company_id, date, project, location, trade, category, subcategory, description, severity, created_at, created_by, updated_at, updated_by, status, version_number, previous_version_id, record_hash, previous_hash, change_reason, is_deleted";

type SorUpdatePayload = {
  date?: string;
  project?: string;
  location?: string;
  trade?: string;
  category?: string;
  subcategory?: string;
  description?: string;
  severity?: string;
};

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_view_dashboards", "can_view_all_company_data", "can_view_reports"],
  });
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const scope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!scope.companyId) return NextResponse.json({ error: "No company scope found." }, { status: 400 });

  const result = await auth.supabase
    .from("company_sor_records")
    .select(SOR_SELECT)
    .eq("id", id)
    .eq("company_id", scope.companyId)
    .single();
  if (result.error) return NextResponse.json({ error: result.error.message || "SOR not found." }, { status: 404 });
  return NextResponse.json({ record: result.data });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_edit_documents", "can_submit_documents", "can_view_all_company_data"],
  });
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const scope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!scope.companyId) return NextResponse.json({ error: "No company scope found." }, { status: 400 });

  const current = await auth.supabase
    .from("company_sor_records")
    .select(SOR_SELECT)
    .eq("id", id)
    .eq("company_id", scope.companyId)
    .single();
  if (current.error) return NextResponse.json({ error: current.error.message || "SOR not found." }, { status: 404 });
  if (current.data.status !== "draft") {
    return NextResponse.json({ error: "Only draft SOR records can be edited." }, { status: 409 });
  }
  if (current.data.created_by !== auth.user.id) {
    return NextResponse.json({ error: "You can only edit your own draft SOR records." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as SorUpdatePayload | null;
  const updatePayload = {
    ...(typeof body?.date === "string" ? { date: body.date.trim() } : {}),
    ...(typeof body?.project === "string" ? { project: body.project.trim() } : {}),
    ...(typeof body?.location === "string" ? { location: body.location.trim() } : {}),
    ...(typeof body?.trade === "string" ? { trade: body.trade.trim() } : {}),
    ...(typeof body?.category === "string" ? { category: body.category.trim() } : {}),
    ...(typeof body?.subcategory === "string" ? { subcategory: body.subcategory.trim() || null } : {}),
    ...(typeof body?.description === "string" ? { description: body.description.trim() } : {}),
    ...(typeof body?.severity === "string" ? { severity: body.severity.trim().toLowerCase() } : {}),
    updated_by: auth.user.id,
  };

  const updated = await auth.supabase
    .from("company_sor_records")
    .update(updatePayload)
    .eq("id", id)
    .eq("company_id", scope.companyId)
    .select(SOR_SELECT)
    .single();
  if (updated.error) return NextResponse.json({ error: updated.error.message || "Failed to update draft." }, { status: 500 });

  const hash = computeSorHash({
    date: updated.data.date,
    project: updated.data.project,
    location: updated.data.location,
    trade: updated.data.trade,
    category: updated.data.category,
    subcategory: updated.data.subcategory,
    description: updated.data.description,
    severity: updated.data.severity,
    created_by: updated.data.created_by,
    created_at: updated.data.created_at,
    previous_hash: updated.data.previous_hash,
    version_number: updated.data.version_number,
  });

  const finalized = await auth.supabase
    .from("company_sor_records")
    .update({ record_hash: hash, updated_by: auth.user.id })
    .eq("id", id)
    .eq("company_id", scope.companyId)
    .select(SOR_SELECT)
    .single();
  if (finalized.error) return NextResponse.json({ error: finalized.error.message || "Failed to update hash." }, { status: 500 });

  return NextResponse.json({ success: true, record: finalized.data });
}
