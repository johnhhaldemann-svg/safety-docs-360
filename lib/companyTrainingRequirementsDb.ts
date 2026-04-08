import type { SupabaseClient } from "@supabase/supabase-js";

/** Columns always present on company_training_requirements after base migration. */
const COLS_BASE = "id, company_id, title, sort_order, match_keywords, match_fields";
const COLS_WITH_RENEWAL = `${COLS_BASE}, renewal_months`;
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

export function isMissingRenewalMonthsError(err: PgErrLike): boolean {
  const parts: string[] = [];
  if (typeof err === "string") parts.push(err);
  else if (err && typeof err === "object") {
    if (err.message) parts.push(err.message);
    if (err.details) parts.push(err.details);
    if (err.hint) parts.push(err.hint);
  }
  const m = parts.join(" ").toLowerCase();
  if (!m) return false;
  if (!m.includes("renewal_months") && !m.includes("renewal months")) return false;
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
    ? `${COLS_WITH_RENEWAL}, ${COLS_APPLY}, ${COLS_TS}`
    : `${COLS_WITH_RENEWAL}, ${COLS_APPLY}`;
}

function selectFullNoRenewal(includeTimestamps: boolean): string {
  return includeTimestamps
    ? `${COLS_BASE}, ${COLS_APPLY}, ${COLS_TS}`
    : `${COLS_BASE}, ${COLS_APPLY}`;
}

function selectLegacy(includeTimestamps: boolean): string {
  return includeTimestamps ? `${COLS_BASE}, ${COLS_TS}` : COLS_BASE;
}

function selectLegacyWithRenewal(includeTimestamps: boolean): string {
  return includeTimestamps ? `${COLS_WITH_RENEWAL}, ${COLS_TS}` : COLS_WITH_RENEWAL;
}

export function selectReturnFull(): string {
  return selectFull(true);
}

/** Use after insert when `renewal_months` column is not present (avoid select errors). */
export function selectReturnFullNoRenewal(): string {
  return selectFullNoRenewal(true);
}

export function selectReturnLegacy(): string {
  return selectLegacy(true);
}

/** Legacy table with renewal_months but no apply_* columns. */
export function selectReturnLegacyWithRenewal(): string {
  return selectLegacyWithRenewal(true);
}

/**
 * Loads company training requirements; falls back to a legacy select if apply_* columns are missing.
 */
function normalizeRequirementRows(
  raw: TrainingRequirementDbRow[],
  applyColumnsAvailable: boolean,
  renewalAvailable: boolean
): TrainingRequirementDbRow[] {
  return raw.map((r) => ({
    ...r,
    apply_trades: applyColumnsAvailable ? r.apply_trades ?? [] : [],
    apply_positions: applyColumnsAvailable ? r.apply_positions ?? [] : [],
    renewal_months: renewalAvailable ? r.renewal_months ?? null : null,
  }));
}

export async function fetchCompanyTrainingRequirements(
  supabase: SupabaseClient,
  companyId: string,
  includeTimestamps: boolean
): Promise<{
  rows: TrainingRequirementDbRow[];
  error: string | null;
  applyColumnsAvailable: boolean;
}> {
  const trySelect = async (columns: string) =>
    supabase
      .from("company_training_requirements")
      .select(columns)
      .eq("company_id", companyId)
      .order("sort_order", { ascending: true });

  const attempts: Array<{
    columns: string;
    applyColumnsAvailable: boolean;
    renewalAvailable: boolean;
  }> = [
    { columns: selectFull(includeTimestamps), applyColumnsAvailable: true, renewalAvailable: true },
    { columns: selectFullNoRenewal(includeTimestamps), applyColumnsAvailable: true, renewalAvailable: false },
    { columns: selectLegacyWithRenewal(includeTimestamps), applyColumnsAvailable: false, renewalAvailable: true },
    { columns: selectLegacy(includeTimestamps), applyColumnsAvailable: false, renewalAvailable: false },
  ];

  let lastMessage = "Failed to load training requirements.";
  for (const a of attempts) {
    const res = await trySelect(a.columns);
    if (!res.error) {
      const raw = (res.data ?? []) as unknown as TrainingRequirementDbRow[];
      return {
        rows: normalizeRequirementRows(raw, a.applyColumnsAvailable, a.renewalAvailable),
        error: null,
        applyColumnsAvailable: a.applyColumnsAvailable,
      };
    }
    lastMessage = res.error.message || lastMessage;
    const missingApply = isMissingApplyColumnsError(res.error);
    const missingRenewal = isMissingRenewalMonthsError(res.error);
    if (!missingApply && !missingRenewal) {
      return { rows: [], error: lastMessage, applyColumnsAvailable: true };
    }
  }

  return { rows: [], error: lastMessage, applyColumnsAvailable: false };
}

export async function fetchTrainingRequirementById(
  supabase: SupabaseClient,
  id: string
): Promise<{
  row: TrainingRequirementDbRow | null;
  error: string | null;
  applyColumnsAvailable: boolean;
  renewalMonthsAvailable: boolean;
}> {
  const attempts: Array<{
    columns: string;
    applyColumnsAvailable: boolean;
    renewalAvailable: boolean;
  }> = [
    { columns: `${COLS_WITH_RENEWAL}, ${COLS_APPLY}`, applyColumnsAvailable: true, renewalAvailable: true },
    { columns: `${COLS_BASE}, ${COLS_APPLY}`, applyColumnsAvailable: true, renewalAvailable: false },
    { columns: COLS_WITH_RENEWAL, applyColumnsAvailable: false, renewalAvailable: true },
    { columns: COLS_BASE, applyColumnsAvailable: false, renewalAvailable: false },
  ];

  let lastMessage = "Failed to load requirement.";
  for (const a of attempts) {
    const res = await supabase.from("company_training_requirements").select(a.columns).eq("id", id).maybeSingle();
    if (!res.error) {
      const raw = res.data as TrainingRequirementDbRow | null;
      if (!raw) {
        return {
          row: null,
          error: null,
          applyColumnsAvailable: a.applyColumnsAvailable,
          renewalMonthsAvailable: a.renewalAvailable,
        };
      }
      const row = normalizeRequirementRows([raw], a.applyColumnsAvailable, a.renewalAvailable)[0];
      return {
        row,
        error: null,
        applyColumnsAvailable: a.applyColumnsAvailable,
        renewalMonthsAvailable: a.renewalAvailable,
      };
    }
    lastMessage = res.error.message || lastMessage;
    if (!isMissingApplyColumnsError(res.error) && !isMissingRenewalMonthsError(res.error)) {
      return {
        row: null,
        error: lastMessage,
        applyColumnsAvailable: true,
        renewalMonthsAvailable: true,
      };
    }
  }

  return {
    row: null,
    error: lastMessage,
    applyColumnsAvailable: false,
    renewalMonthsAvailable: false,
  };
}
