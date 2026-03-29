import type { SupabaseClient } from "@supabase/supabase-js";

const COLS_CORE =
  "id, company_id, title, sort_order, match_keywords, match_fields, renewal_months";
const COLS_APPLY = "apply_trades, apply_positions";
const COLS_TS = "created_at, updated_at";

export const TRAINING_REQUIREMENTS_SCHEMA_WARNING =
  "Your database is missing columns apply_trades and apply_positions. In Supabase → SQL Editor, run the migration that adds them (see supabase/migrations/20260329120000_training_requirements_trade_position.sql). Until then, every requirement applies to all trades and positions, and new saves cannot store trade/position picks.";

/** Paste into Supabase → SQL → New query → Run */
export const TRAINING_REQUIREMENTS_MIGRATION_SQL = `alter table public.company_training_requirements
  add column if not exists apply_trades text[] not null default '{}'::text[],
  add column if not exists apply_positions text[] not null default '{}'::text[];`;

export type TrainingRequirementDbRow = {
  id: string;
  company_id: string;
  title: string;
  sort_order: number;
  match_keywords: string[];
  match_fields: string[];
  apply_trades: string[] | null;
  apply_positions: string[] | null;
  renewal_months: number | null;
  created_at?: string;
  updated_at?: string;
};

type PgErrLike = { message?: string; details?: string; hint?: string } | string | null | undefined;

/** Detects missing apply_* columns from Postgres / PostgREST wording variants. */
export function isMissingApplyColumnsError(err: PgErrLike): boolean {
  const parts: string[] = [];
  if (typeof err === "string") parts.push(err);
  else if (err && typeof err === "object") {
    if (err.message) parts.push(err.message);
    if (err.details) parts.push(err.details);
    if (err.hint) parts.push(err.hint);
  }
  const m = parts.join(" ").toLowerCase();
  if (!m) return false;
  const mentionsApply =
    m.includes("apply_trades") ||
    m.includes("apply_positions") ||
    m.includes("apply trades") ||
    m.includes("apply positions");
  if (!mentionsApply) return false;
  return (
    m.includes("does not exist") ||
    m.includes("could not find") ||
    m.includes("unknown column") ||
    m.includes("undefined column") ||
    m.includes("schema cache")
  );
}

function selectFull(includeTimestamps: boolean): string {
  return includeTimestamps
    ? `${COLS_CORE}, ${COLS_APPLY}, ${COLS_TS}`
    : `${COLS_CORE}, ${COLS_APPLY}`;
}

function selectLegacy(includeTimestamps: boolean): string {
  return includeTimestamps ? `${COLS_CORE}, ${COLS_TS}` : COLS_CORE;
}

export function selectReturnFull(): string {
  return selectFull(true);
}

export function selectReturnLegacy(): string {
  return selectLegacy(true);
}

/**
 * Loads company training requirements; falls back to a legacy select if apply_* columns are missing.
 */
export async function fetchCompanyTrainingRequirements(
  supabase: SupabaseClient,
  companyId: string,
  includeTimestamps: boolean
): Promise<{
  rows: TrainingRequirementDbRow[];
  error: string | null;
  applyColumnsAvailable: boolean;
}> {
  const full = selectFull(includeTimestamps);
  let res = await supabase
    .from("company_training_requirements")
    .select(full)
    .eq("company_id", companyId)
    .order("sort_order", { ascending: true });

  if (res.error && isMissingApplyColumnsError(res.error)) {
    const legacy = selectLegacy(includeTimestamps);
    res = await supabase
      .from("company_training_requirements")
      .select(legacy)
      .eq("company_id", companyId)
      .order("sort_order", { ascending: true });

    if (res.error) {
      return { rows: [], error: res.error.message, applyColumnsAvailable: false };
    }

    const rows = ((res.data ?? []) as unknown as TrainingRequirementDbRow[]).map((r) => ({
      ...r,
      apply_trades: [],
      apply_positions: [],
    }));
    return { rows, error: null, applyColumnsAvailable: false };
  }

  if (res.error) {
    return { rows: [], error: res.error.message, applyColumnsAvailable: true };
  }

  return {
    rows: (res.data ?? []) as unknown as TrainingRequirementDbRow[],
    error: null,
    applyColumnsAvailable: true,
  };
}

export async function fetchTrainingRequirementById(
  supabase: SupabaseClient,
  id: string
): Promise<{
  row: TrainingRequirementDbRow | null;
  error: string | null;
  applyColumnsAvailable: boolean;
}> {
  const full = `${COLS_CORE}, ${COLS_APPLY}`;
  let res = await supabase.from("company_training_requirements").select(full).eq("id", id).maybeSingle();

  if (res.error && isMissingApplyColumnsError(res.error)) {
    res = await supabase.from("company_training_requirements").select(COLS_CORE).eq("id", id).maybeSingle();
    if (res.error) {
      return { row: null, error: res.error.message, applyColumnsAvailable: false };
    }
    const raw = res.data as TrainingRequirementDbRow | null;
    if (!raw) return { row: null, error: null, applyColumnsAvailable: false };
    return {
      row: { ...raw, apply_trades: [], apply_positions: [] },
      error: null,
      applyColumnsAvailable: false,
    };
  }

  if (res.error) {
    return { row: null, error: res.error.message, applyColumnsAvailable: true };
  }

  return {
    row: res.data as TrainingRequirementDbRow | null,
    error: null,
    applyColumnsAvailable: true,
  };
}
