import { NextResponse } from "next/server";
import { authorizeRequest, isCompanyRole } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { canMutateCompanyTrainingRequirements } from "@/lib/companyTrainingAccess";
import {
  filterAllowedPositions,
  filterAllowedTrades,
} from "@/lib/constructionProfileOptions";
import {
  fetchTrainingRequirementById,
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

type RouteContext = { params: Promise<{ id: string }> };
type RequirementRow = TrainingRequirementDbRow;

function selectAfterUpdate(flags: {
  applyColumnsAvailable: boolean;
  taskScopeColumnsAvailable: boolean;
  generatedColumnsAvailable: boolean;
  renewalMonthsAvailable: boolean;
}): string {
  if (
    flags.applyColumnsAvailable &&
    flags.taskScopeColumnsAvailable &&
    flags.generatedColumnsAvailable &&
    flags.renewalMonthsAvailable
  ) {
    return selectReturnFull();
  }
  if (
    flags.applyColumnsAvailable &&
    flags.taskScopeColumnsAvailable &&
    flags.generatedColumnsAvailable &&
    !flags.renewalMonthsAvailable
  ) {
    return selectReturnFullNoRenewal();
  }
  if (
    flags.applyColumnsAvailable &&
    flags.taskScopeColumnsAvailable &&
    !flags.generatedColumnsAvailable &&
    flags.renewalMonthsAvailable
  ) {
    return selectReturnScopeNoGenerated();
  }
  if (
    flags.applyColumnsAvailable &&
    flags.taskScopeColumnsAvailable &&
    !flags.generatedColumnsAvailable &&
    !flags.renewalMonthsAvailable
  ) {
    return selectReturnScopeNoGeneratedNoRenewal();
  }
  if (flags.applyColumnsAvailable && flags.renewalMonthsAvailable) {
    return selectReturnBasicApply();
  }
  if (flags.applyColumnsAvailable && !flags.renewalMonthsAvailable) {
    return selectReturnBasicApplyNoRenewal();
  }
  if (flags.renewalMonthsAvailable) {
    return selectReturnLegacyWithRenewal();
  }
  return selectReturnLegacy();
}

function parseKeywords(input: unknown): string[] | null {
  if (input === undefined) return null;
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

function parseMatchFields(input: unknown): string[] | null {
  if (input === undefined) return null;
  if (Array.isArray(input)) {
    return input.map((x) => String(x).trim().toLowerCase()).filter(Boolean);
  }
  if (typeof input === "string" && input.trim()) {
    return input
      .split(/[\n,]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
  }
  return [];
}

function parseScopedStrings(input: unknown, mode: "label" | "taskCode"): string[] | null {
  if (input === undefined) return null;
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

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await authorizeRequest(request);

  if ("error" in auth) {
    return auth.error;
  }

  if (!canMutateCompanyTrainingRequirements(auth.role, auth.permissionMap)) {
    return NextResponse.json(
      { error: "You do not have permission to update training requirements." },
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

  const { id: rawId } = await context.params;
  const id = rawId.trim();
  if (!id) {
    return NextResponse.json({ error: "Requirement id is required." }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const loaded = await fetchTrainingRequirementById(auth.supabase, id);

  if (loaded.error) {
    return NextResponse.json(
      { error: loaded.error || "Failed to load requirement." },
      { status: 500 }
    );
  }

  const existing = loaded.row as RequirementRow | null;
  if (!existing || existing.company_id !== companyScope.companyId) {
    return NextResponse.json({ error: "Training requirement not found." }, { status: 404 });
  }
  if (existing.is_generated) {
    return NextResponse.json(
      { error: "Generated training requirements are read-only." },
      { status: 403 }
    );
  }

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    updated_by: auth.user.id,
  };

  if (typeof body?.title === "string") {
    const title = body.title.trim();
    if (!title) {
      return NextResponse.json({ error: "Title cannot be empty." }, { status: 400 });
    }
    updates.title = title;
  }

  const kw = parseKeywords(body?.keywords ?? body?.matchKeywords);
  if (kw !== null) {
    if (kw.length === 0) {
      return NextResponse.json(
        { error: "At least one keyword is required (comma or line separated)." },
        { status: 400 }
      );
    }
    updates.match_keywords = kw;
  }

  const mf = parseMatchFields(body?.matchFields);
  if (mf !== null) {
    updates.match_fields = mf.length ? mf : [...DEFAULT_MATCH_FIELDS];
  }

  if (body?.applyTrades !== undefined) {
    const trades = filterAllowedTrades(body.applyTrades);
    if (trades.length === 0) {
      return NextResponse.json(
        { error: "Select at least one trade this requirement applies to." },
        { status: 400 }
      );
    }
    updates.apply_trades = trades;
  }

  if (body?.applyPositions !== undefined) {
    const positions = filterAllowedPositions(body.applyPositions);
    if (positions.length === 0) {
      return NextResponse.json(
        { error: "Select at least one position this requirement applies to." },
        { status: 400 }
      );
    }
    updates.apply_positions = positions;
  }

  const applySubTrades = parseScopedStrings(body?.applySubTrades, "label");
  if (applySubTrades !== null) {
    updates.apply_sub_trades = applySubTrades;
  }

  const applyTaskCodes = parseScopedStrings(body?.applyTaskCodes, "taskCode");
  if (applyTaskCodes !== null) {
    updates.apply_task_codes = applyTaskCodes;
  }

  if (typeof body?.sortOrder === "number" && Number.isFinite(body.sortOrder)) {
    updates.sort_order = body.sortOrder;
  }

  const renewalPatch = normalizeRenewalMonths(body?.renewalMonths, "patch");
  if (renewalPatch !== undefined) {
    updates.renewal_months = renewalPatch;
  }

  let schemaWarning: string | null = null;
  if (!loaded.applyColumnsAvailable) {
    if ("apply_trades" in updates || "apply_positions" in updates) {
      schemaWarning = TRAINING_REQUIREMENTS_SCHEMA_WARNING;
    }
    delete updates.apply_trades;
    delete updates.apply_positions;
  }
  if (!loaded.taskScopeColumnsAvailable) {
    if ("apply_sub_trades" in updates || "apply_task_codes" in updates) {
      schemaWarning = TRAINING_REQUIREMENTS_SCHEMA_WARNING;
    }
    delete updates.apply_sub_trades;
    delete updates.apply_task_codes;
  }
  if (!loaded.renewalMonthsAvailable && "renewal_months" in updates) {
    delete updates.renewal_months;
  }

  const updateRes = await auth.supabase
    .from("company_training_requirements")
    .update(updates)
    .eq("id", id)
    .eq("company_id", companyScope.companyId)
    .select(
      selectAfterUpdate({
        applyColumnsAvailable: loaded.applyColumnsAvailable,
        taskScopeColumnsAvailable: loaded.taskScopeColumnsAvailable,
        generatedColumnsAvailable: loaded.generatedColumnsAvailable,
        renewalMonthsAvailable: loaded.renewalMonthsAvailable,
      })
    )
    .single();

  const updated = updateRes.data as RequirementRow | null;
  if (updateRes.error || !updated) {
    return NextResponse.json(
      { error: updateRes.error?.message || "Failed to update training requirement." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    schemaWarning,
    requirement: toRequirementResponse(updated),
  });
}

export async function DELETE(request: Request, context: RouteContext) {
  const auth = await authorizeRequest(request);

  if ("error" in auth) {
    return auth.error;
  }

  if (!canMutateCompanyTrainingRequirements(auth.role, auth.permissionMap)) {
    return NextResponse.json(
      { error: "You do not have permission to delete training requirements." },
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

  const { id: rawId } = await context.params;
  const id = rawId.trim();
  if (!id) {
    return NextResponse.json({ error: "Requirement id is required." }, { status: 400 });
  }

  const loaded = await fetchTrainingRequirementById(auth.supabase, id);
  if (loaded.error) {
    return NextResponse.json(
      { error: loaded.error || "Failed to load requirement." },
      { status: 500 }
    );
  }

  const existing = loaded.row as RequirementRow | null;
  if (!existing || existing.company_id !== companyScope.companyId) {
    return NextResponse.json({ error: "Training requirement not found." }, { status: 404 });
  }
  if (existing.is_generated) {
    return NextResponse.json(
      { error: "Generated training requirements are read-only." },
      { status: 403 }
    );
  }

  const { error } = await auth.supabase
    .from("company_training_requirements")
    .delete()
    .eq("id", id)
    .eq("company_id", companyScope.companyId);

  if (error) {
    return NextResponse.json(
      { error: error.message || "Failed to delete training requirement." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
