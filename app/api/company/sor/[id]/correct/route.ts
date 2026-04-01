import { NextResponse } from "next/server";
import { authorizeRequest, isAdminRole, normalizeAppRole } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { computeSorHash } from "@/lib/sor/hash";

export const runtime = "nodejs";

const SOR_SELECT =
  "id, company_id, date, project, location, trade, category, subcategory, description, severity, created_at, created_by, updated_at, updated_by, status, version_number, previous_version_id, record_hash, previous_hash, change_reason, is_deleted";

type CorrectPayload = {
  date?: string;
  project?: string;
  location?: string;
  trade?: string;
  category?: string;
  subcategory?: string;
  description?: string;
  severity?: string;
  change_reason?: string;
};

function canCreateCorrectedVersion(role: string) {
  if (isAdminRole(role)) return true;
  const normalized = normalizeAppRole(role);
  return normalized === "company_admin";
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_manage_observations", "can_view_all_company_data"],
  });
  if ("error" in auth) return auth.error;
  if (!canCreateCorrectedVersion(auth.role)) {
    return NextResponse.json({ error: "Only admins can create corrected SOR versions." }, { status: 403 });
  }

  const { id } = await params;
  const scope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!scope.companyId) return NextResponse.json({ error: "No company scope found." }, { status: 400 });

  const baseResult = await auth.supabase
    .from("company_sor_records")
    .select(SOR_SELECT)
    .eq("id", id)
    .eq("company_id", scope.companyId)
    .single();
  if (baseResult.error) return NextResponse.json({ error: baseResult.error.message || "SOR not found." }, { status: 404 });
  if (!["submitted", "locked"].includes(baseResult.data.status)) {
    return NextResponse.json({ error: "Only submitted/locked SOR records can be corrected." }, { status: 409 });
  }

  const body = (await request.json().catch(() => null)) as CorrectPayload | null;
  const changeReason = String(body?.change_reason ?? "").trim();
  if (!changeReason) {
    return NextResponse.json({ error: "change_reason is required when creating a corrected version." }, { status: 400 });
  }

  const nextVersion = baseResult.data.version_number + 1;
  const now = new Date().toISOString();
  const insertResult = await auth.supabase
    .from("company_sor_records")
    .insert({
      company_id: scope.companyId,
      date: String(body?.date ?? baseResult.data.date).trim(),
      project: String(body?.project ?? baseResult.data.project).trim(),
      location: String(body?.location ?? baseResult.data.location).trim(),
      trade: String(body?.trade ?? baseResult.data.trade).trim(),
      category: String(body?.category ?? baseResult.data.category).trim(),
      subcategory:
        typeof body?.subcategory === "string"
          ? body.subcategory.trim() || null
          : baseResult.data.subcategory,
      description: String(body?.description ?? baseResult.data.description).trim(),
      severity: String(body?.severity ?? baseResult.data.severity).trim().toLowerCase(),
      created_by: baseResult.data.created_by,
      updated_by: auth.user.id,
      status: "submitted",
      version_number: nextVersion,
      previous_version_id: baseResult.data.id,
      previous_hash: baseResult.data.record_hash,
      record_hash: null,
      change_reason: changeReason,
      is_deleted: false,
      created_at: now,
      updated_at: now,
    })
    .select(SOR_SELECT)
    .single();
  if (insertResult.error) {
    return NextResponse.json({ error: insertResult.error.message || "Failed to create corrected version." }, { status: 500 });
  }

  const nextHash = computeSorHash({
    date: insertResult.data.date,
    project: insertResult.data.project,
    location: insertResult.data.location,
    trade: insertResult.data.trade,
    category: insertResult.data.category,
    subcategory: insertResult.data.subcategory,
    description: insertResult.data.description,
    severity: insertResult.data.severity,
    created_by: insertResult.data.created_by,
    created_at: insertResult.data.created_at,
    previous_hash: insertResult.data.previous_hash,
    version_number: insertResult.data.version_number,
  });

  const hashUpdate = await auth.supabase
    .from("company_sor_records")
    .update({ record_hash: nextHash, updated_by: auth.user.id })
    .eq("id", insertResult.data.id)
    .eq("company_id", scope.companyId)
    .select(SOR_SELECT)
    .single();
  if (hashUpdate.error) {
    return NextResponse.json({ error: hashUpdate.error.message || "Failed to finalize corrected version hash." }, { status: 500 });
  }

  const supersede = await auth.supabase
    .from("company_sor_records")
    .update({ status: "superseded", updated_by: auth.user.id })
    .eq("id", baseResult.data.id)
    .eq("company_id", scope.companyId);
  if (supersede.error) {
    return NextResponse.json({ error: supersede.error.message || "Corrected version created, but old row could not be superseded." }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    record: hashUpdate.data,
    supersededId: baseResult.data.id,
  });
}
