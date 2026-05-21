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
  isMissingGeneratedColumnsError,
  isMissingRenewalMonthsError,
  isMissingTaskScopeColumnsError,
  selectReturnBasicApply,
  selectReturnBasicApplyNoRenewal,
  selectReturnFull,
  selectReturnFullNoRenewal,
  selectReturnLegacy,
  selectReturnLegacyWithRenewal,
  selectReturnScopeNoGenerated,
  selectReturnScopeNoGeneratedNoRenewal,
  TRAINING_REQUIREMENTS_SCHEMA_WARNING,
  type TrainingRequirementDbRow,
} from "@/lib/companyTrainingRequirementsDb";
import { normalizeRenewalMonths } from "@/lib/trainingRequirementRenewal";
import { DEFAULT_MATCH_FIELDS } from "@/lib/trainingMatrix";

export const runtime = "nodejs";

type RequirementRow = TrainingRequirementDbRow;

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

function parseScopedStrings(input: unknown, mode: "label" | "taskCode"): string[] {
  if (!Array.isArray(input)) return [];
  const values = input
    .map((value) => String(value).trim())
    .filter(Boolean)
    .map((value) =>
      mode === "taskCode" ? value.toLowerCase().replace(/\s+/g, "_") : value
    );
  return [...new Set(values)];
}

function toRequirementResponse(row: RequirementRow) {
  return {
    id: row.id,
    title: row.title,
    sortOrder: row.sort_order,
    matchKeywords: row.match_keywords ?? [],
    matchFields: row.match_fields?.length ? row.match_fields : [...DEFAULT_MATCH_FIELDS],
    applyTrades: row.apply_trades ?? [],
    applyPositions: row.apply_positions ?? [],
    applySubTrades: row.apply_sub_trades ?? [],
    applyTaskCodes: row.apply_task_codes ?? [],
    renewalMonths: row.renewal_months ?? null,
    isGenerated: Boolean(row.is_generated),
    generatedSourceType: row.generated_source_type ?? null,
    generatedSourceDocumentId: row.generated_source_document_id ?? null,
    generatedSourceOperationKey: row.generated_source_operation_key ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function GET(request: Request) {
  const auth = await authorizeRequest(request);

  if ("error" in auth) {
    return auth.error;
  }

  if (!canViewCompanyTrainingMatrix(auth.role, auth.permissionMap)) {
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

  const fetched = await fetchCompanyTrainingRequirements(auth.supabase, companyScope.companyId, true);

  if (fetched.error) {
    return NextResponse.json(
      { error: fetched.error || "Failed to load training requirements." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    requirements: fetched.rows.map(toRequirementResponse),
    capabilities: {
      canMutate: canMutateCompanyTrainingRequirements(auth.role, auth.permissionMap),
    },
    schemaWarning:
      fetched.applyColumnsAvailable &&
      fetched.taskScopeColumnsAvailable &&
      fetched.generatedColumnsAvailable
        ? null
        : TRAINING_REQUIREMENTS_SCHEMA_WARNING,
  });
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request);

  if ("error" in auth) {
    return auth.error;
  }

  if (!canMutateCompanyTrainingRequirements(auth.role, auth.permissionMap)) {
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
  const applySubTrades = parseScopedStrings(body?.applySubTrades, "label");
  const applyTaskCodes = parseScopedStrings(body?.applyTaskCodes, "taskCode");

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
  const renewalMonths = normalizeRenewalMonths(body?.renewalMonths, "create");

  const baseInsert: Record<string, unknown> = {
    company_id: companyScope.companyId,
    title,
    sort_order: sortOrder,
    match_keywords: matchKeywords,
    match_fields: matchFields,
    created_at: nowIso,
    updated_at: nowIso,
    created_by: auth.user.id,
    updated_by: auth.user.id,
  };

  const attempts: Array<{
    payload: Record<string, unknown>;
    select: string;
    applyColumnsAvailable: boolean;
    taskScopeColumnsAvailable: boolean;
    generatedColumnsAvailable: boolean;
  }> = [
    {
      payload: {
        ...baseInsert,
        apply_trades: applyTrades,
        apply_positions: applyPositions,
        apply_sub_trades: applySubTrades,
        apply_task_codes: applyTaskCodes,
        renewal_months: renewalMonths,
        is_generated: false,
      },
      select: selectReturnFull(),
      applyColumnsAvailable: true,
      taskScopeColumnsAvailable: true,
      generatedColumnsAvailable: true,
    },
    {
      payload: {
        ...baseInsert,
        apply_trades: applyTrades,
        apply_positions: applyPositions,
        apply_sub_trades: applySubTrades,
        apply_task_codes: applyTaskCodes,
        is_generated: false,
      },
      select: selectReturnFullNoRenewal(),
      applyColumnsAvailable: true,
      taskScopeColumnsAvailable: true,
      generatedColumnsAvailable: true,
    },
    {
      payload: {
        ...baseInsert,
        apply_trades: applyTrades,
        apply_positions: applyPositions,
        apply_sub_trades: applySubTrades,
        apply_task_codes: applyTaskCodes,
        renewal_months: renewalMonths,
      },
      select: selectReturnScopeNoGenerated(),
      applyColumnsAvailable: true,
      taskScopeColumnsAvailable: true,
      generatedColumnsAvailable: false,
    },
    {
      payload: {
        ...baseInsert,
        apply_trades: applyTrades,
        apply_positions: applyPositions,
        apply_sub_trades: applySubTrades,
        apply_task_codes: applyTaskCodes,
      },
      select: selectReturnScopeNoGeneratedNoRenewal(),
      applyColumnsAvailable: true,
      taskScopeColumnsAvailable: true,
      generatedColumnsAvailable: false,
    },
    {
      payload: {
        ...baseInsert,
        apply_trades: applyTrades,
        apply_positions: applyPositions,
        renewal_months: renewalMonths,
      },
      select: selectReturnBasicApply(),
      applyColumnsAvailable: true,
      taskScopeColumnsAvailable: false,
      generatedColumnsAvailable: false,
    },
    {
      payload: {
        ...baseInsert,
        apply_trades: applyTrades,
        apply_positions: applyPositions,
      },
      select: selectReturnBasicApplyNoRenewal(),
      applyColumnsAvailable: true,
      taskScopeColumnsAvailable: false,
      generatedColumnsAvailable: false,
    },
    {
      payload: {
        ...baseInsert,
        renewal_months: renewalMonths,
      },
      select: selectReturnLegacyWithRenewal(),
      applyColumnsAvailable: false,
      taskScopeColumnsAvailable: false,
      generatedColumnsAvailable: false,
    },
    {
      payload: baseInsert,
      select: selectReturnLegacy(),
      applyColumnsAvailable: false,
      taskScopeColumnsAvailable: false,
      generatedColumnsAvailable: false,
    },
  ];

  let created: RequirementRow | null = null;
  let schemaWarning: string | null = null;
  let lastError = "Failed to create training requirement.";

  for (const attempt of attempts) {
    const createdRes = await auth.supabase
      .from("company_training_requirements")
      .insert(attempt.payload)
      .select(attempt.select)
      .single();

    if (!createdRes.error && createdRes.data) {
      created = createdRes.data as unknown as RequirementRow;
      if (
        !attempt.applyColumnsAvailable ||
        !attempt.taskScopeColumnsAvailable ||
        !attempt.generatedColumnsAvailable
      ) {
        schemaWarning = TRAINING_REQUIREMENTS_SCHEMA_WARNING;
      }
      break;
    }

    lastError = createdRes.error?.message || lastError;
    const missingKnownColumns =
      isMissingApplyColumnsError(createdRes.error) ||
      isMissingTaskScopeColumnsError(createdRes.error) ||
      isMissingGeneratedColumnsError(createdRes.error) ||
      isMissingRenewalMonthsError(createdRes.error);

    if (!missingKnownColumns) {
      return NextResponse.json({ error: lastError }, { status: 500 });
    }
  }

  if (!created) {
    return NextResponse.json({ error: lastError }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    schemaWarning,
    requirement: toRequirementResponse(created),
  });
}
