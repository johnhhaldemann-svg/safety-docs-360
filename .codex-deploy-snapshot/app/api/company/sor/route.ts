import { NextResponse } from "next/server";
import {
  normalizeSorHazardCategoryCode,
  SOR_HAZARD_CATEGORY_CODES,
  SOR_HAZARD_CATEGORY_LABELS,
} from "@/lib/incidents/sorHazardCategory";
import { authorizeRequest } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { companyHasCsepPlanName, csepWorkspaceForbiddenResponse } from "@/lib/csepApiGuard";
import { computeSorHash } from "@/lib/sor/hash";
import { COMPANY_SOR_RECORD_SELECT } from "@/lib/sor/recordSelect";

export const runtime = "nodejs";

const SOR_SELECT = COMPANY_SOR_RECORD_SELECT;

type SorCreatePayload = {
  date?: string;
  project?: string;
  location?: string;
  trade?: string;
  /** Display label; defaults from hazard code when omitted. */
  category?: string;
  /** Required structured hazard class (maps to incident exposure types). */
  hazardCategoryCode?: string;
  subcategory?: string;
  description?: string;
  severity?: string;
};

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_view_dashboards", "can_view_all_company_data", "can_view_reports"],
  });
  if ("error" in auth) return auth.error;

  const scope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!scope.companyId) return NextResponse.json({ records: [] });

  if (await companyHasCsepPlanName(auth.supabase, scope.companyId)) {
    return csepWorkspaceForbiddenResponse();
  }

  const { searchParams } = new URL(request.url);
  const includeDeleted = searchParams.get("includeDeleted") === "true";
  const status = (searchParams.get("status") ?? "").trim().toLowerCase();
  let query = auth.supabase
    .from("company_sor_records")
    .select(SOR_SELECT)
    .eq("company_id", scope.companyId)
    .order("created_at", { ascending: false });
  if (!includeDeleted) query = query.eq("is_deleted", false);
  if (status) query = query.eq("status", status);
  const result = await query;
  if (result.error) {
    return NextResponse.json({ error: result.error.message || "Failed to load SOR records." }, { status: 500 });
  }
  return NextResponse.json({ records: result.data ?? [] });
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_create_documents", "can_submit_documents", "can_view_all_company_data"],
  });
  if ("error" in auth) return auth.error;

  const scope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!scope.companyId) {
    return NextResponse.json({ error: "No company scope found." }, { status: 400 });
  }

  if (await companyHasCsepPlanName(auth.supabase, scope.companyId)) {
    return csepWorkspaceForbiddenResponse();
  }

  const body = (await request.json().catch(() => null)) as SorCreatePayload | null;
  const date = String(body?.date ?? "").trim();
  const project = String(body?.project ?? "").trim();
  const location = String(body?.location ?? "").trim();
  const trade = String(body?.trade ?? "").trim();
  const description = String(body?.description ?? "").trim();
  const hazardCode = normalizeSorHazardCategoryCode(body?.hazardCategoryCode);
  if (!hazardCode) {
    return NextResponse.json(
      {
        error: `hazardCategoryCode is required. Use one of: ${SOR_HAZARD_CATEGORY_CODES.join(", ")}.`,
      },
      { status: 400 }
    );
  }
  const category = String(body?.category ?? "").trim() || SOR_HAZARD_CATEGORY_LABELS[hazardCode];
  if (!date || !project || !location || !trade || !description) {
    return NextResponse.json(
      { error: "date, project, location, trade, and description are required." },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const draftResult = await auth.supabase
    .from("company_sor_records")
    .insert({
      company_id: scope.companyId,
      date,
      project,
      location,
      trade,
      category,
      hazard_category_code: hazardCode,
      subcategory: String(body?.subcategory ?? "").trim() || null,
      description,
      severity: String(body?.severity ?? "").trim().toLowerCase() || "medium",
      created_by: auth.user.id,
      updated_by: auth.user.id,
      status: "draft",
      version_number: 1,
      previous_version_id: null,
      previous_hash: null,
      record_hash: null,
      change_reason: null,
      is_deleted: false,
      created_at: now,
      updated_at: now,
    })
    .select(SOR_SELECT)
    .single();

  if (draftResult.error) {
    return NextResponse.json({ error: draftResult.error.message || "Failed to create draft SOR." }, { status: 500 });
  }

  const hash = computeSorHash({
    date: draftResult.data.date,
    project: draftResult.data.project,
    location: draftResult.data.location,
    trade: draftResult.data.trade,
    category: draftResult.data.category,
    subcategory: draftResult.data.subcategory,
    description: draftResult.data.description,
    severity: draftResult.data.severity,
    created_by: draftResult.data.created_by,
    created_at: draftResult.data.created_at,
    previous_hash: draftResult.data.previous_hash,
    version_number: draftResult.data.version_number,
  });

  const finalized = await auth.supabase
    .from("company_sor_records")
    .update({ record_hash: hash, updated_by: auth.user.id })
    .eq("id", draftResult.data.id)
    .eq("company_id", scope.companyId)
    .select(SOR_SELECT)
    .single();
  if (finalized.error) {
    return NextResponse.json({ error: finalized.error.message || "Failed to finalize SOR hash." }, { status: 500 });
  }

  return NextResponse.json({ success: true, record: finalized.data });
}
