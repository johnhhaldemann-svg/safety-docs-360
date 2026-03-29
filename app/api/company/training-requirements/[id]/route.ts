import { NextResponse } from "next/server";
import { authorizeRequest, isCompanyRole } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { canMutateCompanyTrainingRequirements } from "@/lib/companyTrainingAccess";
import { DEFAULT_MATCH_FIELDS } from "@/lib/trainingMatrix";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

type RequirementRow = {
  id: string;
  company_id: string;
  title: string;
  sort_order: number;
  match_keywords: string[];
  match_fields: string[];
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

  const { data: existingRaw, error: loadError } = await auth.supabase
    .from("company_training_requirements")
    .select("id, company_id, title, sort_order, match_keywords, match_fields")
    .eq("id", id)
    .maybeSingle();

  const existing = existingRaw as RequirementRow | null;

  if (loadError) {
    return NextResponse.json(
      { error: loadError.message || "Failed to load requirement." },
      { status: 500 }
    );
  }

  if (!existing || existing.company_id !== companyScope.companyId) {
    return NextResponse.json({ error: "Training requirement not found." }, { status: 404 });
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

  if (typeof body?.sortOrder === "number" && Number.isFinite(body.sortOrder)) {
    updates.sort_order = body.sortOrder;
  }

  const { data, error } = await auth.supabase
    .from("company_training_requirements")
    .update(updates)
    .eq("id", id)
    .eq("company_id", companyScope.companyId)
    .select("id, company_id, title, sort_order, match_keywords, match_fields, created_at, updated_at")
    .single();

  const updated = data as RequirementRow | null;

  if (error || !updated) {
    return NextResponse.json(
      { error: error?.message || "Failed to update training requirement." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    requirement: {
      id: updated.id,
      title: updated.title,
      sortOrder: updated.sort_order,
      matchKeywords: updated.match_keywords ?? [],
      matchFields: updated.match_fields?.length ? updated.match_fields : [...DEFAULT_MATCH_FIELDS],
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
