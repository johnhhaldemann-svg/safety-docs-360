import { NextResponse } from "next/server";
import { authorizeRequest, isCompanyRole } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import {
  canMutateCompanyTrainingRequirements,
  canViewCompanyTrainingMatrix,
} from "@/lib/companyTrainingAccess";
import {
  filterAllowedPositions,
  filterAllowedTrades,
} from "@/lib/constructionProfileOptions";
import {
  fetchCompanyTrainingRequirements,
  isMissingApplyColumnsError,
  selectReturnFull,
  selectReturnLegacy,
  TRAINING_REQUIREMENTS_SCHEMA_WARNING,
} from "@/lib/companyTrainingRequirementsDb";
import { DEFAULT_MATCH_FIELDS } from "@/lib/trainingMatrix";

export const runtime = "nodejs";

type RequirementRow = {
  id: string;
  company_id: string;
  title: string;
  sort_order: number;
  match_keywords: string[];
  match_fields: string[];
  apply_trades: string[] | null;
  apply_positions: string[] | null;
  created_at: string;
  updated_at: string;
};

function parseKeywords(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input.map(String).map((s) => s.trim()).filter(Boolean);
  }
  if (typeof input === "string") {
    return input
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

function parseMatchFields(input: unknown): string[] {
  if (Array.isArray(input)) {
    const out = input.map((x) => String(x).trim().toLowerCase()).filter(Boolean);
    return out.length ? out : [...DEFAULT_MATCH_FIELDS];
  }
  if (typeof input === "string" && input.trim()) {
    return input
      .split(/[\n,]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
  }
  return [...DEFAULT_MATCH_FIELDS];
}

export async function GET(request: Request) {
  const auth = await authorizeRequest(request);

  if ("error" in auth) {
    return auth.error;
  }

  if (!canViewCompanyTrainingMatrix(auth.role)) {
    return NextResponse.json({ error: "You do not have access to training requirements." }, { status: 403 });
  }

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });

  if (isCompanyRole(auth.role) && !companyScope.companyId) {
    return NextResponse.json(
      { error: "This company account is not linked to a company workspace yet." },
      { status: 400 }
    );
  }

  if (!companyScope.companyId) {
    return NextResponse.json({ requirements: [], capabilities: { canMutate: false } });
  }

  const fetched = await fetchCompanyTrainingRequirements(
    auth.supabase,
    companyScope.companyId,
    true
  );

  if (fetched.error) {
    return NextResponse.json(
      { error: fetched.error || "Failed to load training requirements." },
      { status: 500 }
    );
  }

  const requirements = fetched.rows.map((row) => ({
    id: row.id,
    title: row.title,
    sortOrder: row.sort_order,
    matchKeywords: row.match_keywords ?? [],
    matchFields: row.match_fields?.length ? row.match_fields : [...DEFAULT_MATCH_FIELDS],
    applyTrades: row.apply_trades ?? [],
    applyPositions: row.apply_positions ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  return NextResponse.json({
    requirements,
    capabilities: {
      canMutate: canMutateCompanyTrainingRequirements(auth.role),
    },
    schemaWarning: fetched.applyColumnsAvailable ? null : TRAINING_REQUIREMENTS_SCHEMA_WARNING,
  });
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request);

  if ("error" in auth) {
    return auth.error;
  }

  if (!canMutateCompanyTrainingRequirements(auth.role)) {
    return NextResponse.json(
      { error: "You do not have permission to create training requirements." },
      { status: 403 }
    );
  }

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });

  if (isCompanyRole(auth.role) && !companyScope.companyId) {
    return NextResponse.json(
      { error: "This company account is not linked to a company workspace yet." },
      { status: 400 }
    );
  }

  if (!companyScope.companyId) {
    return NextResponse.json({ error: "Company workspace is required." }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  if (!title) {
    return NextResponse.json({ error: "Title is required." }, { status: 400 });
  }

  const matchKeywords = parseKeywords(body?.keywords ?? body?.matchKeywords);
  if (matchKeywords.length === 0) {
    return NextResponse.json(
      { error: "At least one keyword is required (comma or line separated)." },
      { status: 400 }
    );
  }

  const matchFields = parseMatchFields(body?.matchFields);

  const applyTrades = filterAllowedTrades(body?.applyTrades);
  const applyPositions = filterAllowedPositions(body?.applyPositions);
  if (applyTrades.length === 0) {
    return NextResponse.json(
      { error: "Select at least one trade this requirement applies to." },
      { status: 400 }
    );
  }
  if (applyPositions.length === 0) {
    return NextResponse.json(
      { error: "Select at least one position this requirement applies to." },
      { status: 400 }
    );
  }

  const { data: existing } = await auth.supabase
    .from("company_training_requirements")
    .select("sort_order")
    .eq("company_id", companyScope.companyId);

  const maxOrder = Math.max(
    0,
    ...((existing ?? []).map((r) => r.sort_order).filter((n) => typeof n === "number") as number[])
  );
  const sortOrder =
    typeof body?.sortOrder === "number" && Number.isFinite(body.sortOrder)
      ? body.sortOrder
      : maxOrder + 1;

  const nowIso = new Date().toISOString();

  const insertPayload: Record<string, unknown> = {
    company_id: companyScope.companyId,
    title,
    sort_order: sortOrder,
    match_keywords: matchKeywords,
    match_fields: matchFields,
    apply_trades: applyTrades,
    apply_positions: applyPositions,
    created_at: nowIso,
    updated_at: nowIso,
    created_by: auth.user.id,
    updated_by: auth.user.id,
  };

  let createdRes = await auth.supabase
    .from("company_training_requirements")
    .insert(insertPayload)
    .select(selectReturnFull())
    .single();

  let schemaWarning: string | null = null;
  if (createdRes.error && isMissingApplyColumnsError(createdRes.error)) {
    const { apply_trades: _t, apply_positions: _p, ...legacyPayload } = insertPayload;
    createdRes = await auth.supabase
      .from("company_training_requirements")
      .insert(legacyPayload)
      .select(selectReturnLegacy())
      .single();
    schemaWarning = TRAINING_REQUIREMENTS_SCHEMA_WARNING;
  }

  const created = createdRes.data as RequirementRow | null;

  if (createdRes.error || !created) {
    return NextResponse.json(
      { error: createdRes.error?.message || "Failed to create training requirement." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    schemaWarning,
    requirement: {
      id: created.id,
      title: created.title,
      sortOrder: created.sort_order,
      matchKeywords: created.match_keywords ?? [],
      matchFields: created.match_fields?.length ? created.match_fields : [...DEFAULT_MATCH_FIELDS],
      applyTrades: created.apply_trades ?? [],
      applyPositions: created.apply_positions ?? [],
      createdAt: created.created_at,
      updatedAt: created.updated_at,
    },
  });
}
