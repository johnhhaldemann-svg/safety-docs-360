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
  isMissingRenewalMonthsError,
  selectReturnFull,
  selectReturnFullNoRenewal,
  selectReturnLegacy,
  selectReturnLegacyWithRenewal,
  TRAINING_REQUIREMENTS_SCHEMA_WARNING,
} from "@/lib/companyTrainingRequirementsDb";
import { normalizeRenewalMonths } from "@/lib/trainingRequirementRenewal";
import { DEFAULT_MATCH_FIELDS } from "@/lib/trainingMatrix";

export const runtime = "nodejs";

function selectAfterUpdate(applyColumnsAvailable: boolean, renewalMonthsAvailable: boolean): string {
  if (applyColumnsAvailable && renewalMonthsAvailable) return selectReturnFull();
  if (applyColumnsAvailable && !renewalMonthsAvailable) return selectReturnFullNoRenewal();
  if (!applyColumnsAvailable && renewalMonthsAvailable) return selectReturnLegacyWithRenewal();
  return selectReturnLegacy();
}

type RouteContext = { params: Promise<{ id: string }> };

type RequirementRow = {
  id: string;
  company_id: string;
  title: string;
  sort_order: number;
  match_keywords: string[];
  match_fields: string[];
  apply_trades?: string[] | null;
  apply_positions?: string[] | null;
  renewal_months?: number | null;
  created_at?: string;
  updated_at?: string;
};

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

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await authorizeRequest(request);

  if ("error" in auth) {
    return auth.error;
  }

  if (!canMutateCompanyTrainingRequirements(auth.role)) {
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

  const applyColumnsAvailable = loaded.applyColumnsAvailable;
  const renewalMonthsAvailable = loaded.renewalMonthsAvailable;

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
    const t = filterAllowedTrades(body.applyTrades);
    if (t.length === 0) {
      return NextResponse.json(
        { error: "Select at least one trade this requirement applies to." },
        { status: 400 }
      );
    }
    updates.apply_trades = t;
  }

  if (body?.applyPositions !== undefined) {
    const p = filterAllowedPositions(body.applyPositions);
    if (p.length === 0) {
      return NextResponse.json(
        { error: "Select at least one position this requirement applies to." },
        { status: 400 }
      );
    }
    updates.apply_positions = p;
  }

  if (typeof body?.sortOrder === "number" && Number.isFinite(body.sortOrder)) {
    updates.sort_order = body.sortOrder;
  }

  const renewalPatch = normalizeRenewalMonths(body?.renewalMonths, "patch");
  if (renewalPatch !== undefined) {
    updates.renewal_months = renewalPatch;
  }

  let schemaWarning: string | null = null;
  if (!applyColumnsAvailable) {
    if ("apply_trades" in updates || "apply_positions" in updates) {
      schemaWarning = TRAINING_REQUIREMENTS_SCHEMA_WARNING;
    }
    delete updates.apply_trades;
    delete updates.apply_positions;
  }

  if (!renewalMonthsAvailable && "renewal_months" in updates) {
    delete updates.renewal_months;
  }

  let returnSelect = selectAfterUpdate(applyColumnsAvailable, renewalMonthsAvailable);
  let updatePayload: Record<string, unknown> = { ...updates };

  let updateRes = await auth.supabase
    .from("company_training_requirements")
    .update(updatePayload)
    .eq("id", id)
    .eq("company_id", companyScope.companyId)
    .select(returnSelect)
    .single();

  if (updateRes.error && isMissingRenewalMonthsError(updateRes.error)) {
    updatePayload = { ...updatePayload };
    delete updatePayload.renewal_months;
    returnSelect = selectAfterUpdate(applyColumnsAvailable, false);
    updateRes = await auth.supabase
      .from("company_training_requirements")
      .update(updatePayload)
      .eq("id", id)
      .eq("company_id", companyScope.companyId)
      .select(returnSelect)
      .single();
  }

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
    requirement: {
      id: updated.id,
      title: updated.title,
      sortOrder: updated.sort_order,
      matchKeywords: updated.match_keywords ?? [],
      matchFields: updated.match_fields?.length ? updated.match_fields : [...DEFAULT_MATCH_FIELDS],
      applyTrades: updated.apply_trades ?? [],
      applyPositions: updated.apply_positions ?? [],
      renewalMonths: updated.renewal_months ?? null,
      createdAt: updated.created_at,
      updatedAt: updated.updated_at,
    },
  });
}

export async function DELETE(request: Request, context: RouteContext) {
  const auth = await authorizeRequest(request);

  if ("error" in auth) {
    return auth.error;
  }

  if (!canMutateCompanyTrainingRequirements(auth.role)) {
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
