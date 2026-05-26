import type { SupabaseClient } from "@supabase/supabase-js";

/** Columns always present on company_training_requirements after base migration. */
const COLS_BASE = "id, company_id, title, sort_order, match_keywords, match_fields";
const COLS_WITH_RENEWAL = `${COLS_BASE}, renewal_months`;
const COLS_APPLY = "apply_trades, apply_positions";
const COLS_TASK_SCOPE = "apply_sub_trades, apply_task_codes";
const COLS_GENERATED =
  "is_generated, generated_source_type, generated_source_document_id, generated_source_operation_key";
const COLS_RESOURCE =
  "training_delivery_type, training_resource_title, training_resource_url, training_resource_instructions";
const COLS_TS = "created_at, updated_at";

export const TRAINING_REQUIREMENTS_SCHEMA_WARNING =
  "Your database is missing training requirement columns. Run the latest company training requirement migrations in Supabase SQL Editor so scope rules and assignment resource links can be stored correctly.";

/** Paste into Supabase SQL Editor and run if the latest training requirement migration has not been applied. */
export const TRAINING_REQUIREMENTS_MIGRATION_SQL = `alter table public.company_training_requirements
  add column if not exists apply_trades text[] not null default '{}'::text[],
  add column if not exists apply_positions text[] not null default '{}'::text[],
  add column if not exists apply_sub_trades text[] not null default '{}'::text[],
  add column if not exists apply_task_codes text[] not null default '{}'::text[],
  add column if not exists is_generated boolean not null default false,
  add column if not exists generated_source_type text,
  add column if not exists generated_source_document_id uuid,
  add column if not exists generated_source_operation_key text,
  add column if not exists training_delivery_type text,
  add column if not exists training_resource_title text,
  add column if not exists training_resource_url text,
  add column if not exists training_resource_instructions text;`;

export type TrainingRequirementDbRow = {
  id: string;
  company_id: string;
  title: string;
  sort_order: number;
  match_keywords: string[];
  match_fields: string[];
  apply_trades: string[] | null;
  apply_positions: string[] | null;
  apply_sub_trades: string[] | null;
  apply_task_codes: string[] | null;
  renewal_months: number | null;
  is_generated: boolean | null;
  generated_source_type: string | null;
  generated_source_document_id: string | null;
  generated_source_operation_key: string | null;
  training_delivery_type: string | null;
  training_resource_title: string | null;
  training_resource_url: string | null;
  training_resource_instructions: string | null;
  created_at?: string;
  updated_at?: string;
};

type PgErrLike = { message?: string; details?: string; hint?: string } | string | null | undefined;

function errorMessage(err: PgErrLike): string {
  const parts: string[] = [];
  if (typeof err === "string") {
    parts.push(err);
  } else if (err && typeof err === "object") {
    if (err.message) parts.push(err.message);
    if (err.details) parts.push(err.details);
    if (err.hint) parts.push(err.hint);
  }
  return parts.join(" ").toLowerCase();
}

function missingColumnMessage(message: string, tokens: string[]): boolean {
  if (!message) return false;
  if (!tokens.some((token) => message.includes(token))) return false;
  return (
    message.includes("does not exist") ||
    message.includes("could not find") ||
    message.includes("unknown column") ||
    message.includes("undefined column") ||
    message.includes("schema cache")
  );
}

/** Detects missing apply_* columns from Postgres / PostgREST wording variants. */
export function isMissingApplyColumnsError(err: PgErrLike): boolean {
  return missingColumnMessage(errorMessage(err), [
    "apply_trades",
    "apply_positions",
    "apply trades",
    "apply positions",
  ]);
}

export function isMissingTaskScopeColumnsError(err: PgErrLike): boolean {
  return missingColumnMessage(errorMessage(err), [
    "apply_sub_trades",
    "apply_task_codes",
    "apply sub trades",
    "apply task codes",
  ]);
}

export function isMissingGeneratedColumnsError(err: PgErrLike): boolean {
  return missingColumnMessage(errorMessage(err), [
    "is_generated",
    "generated_source_type",
    "generated_source_document_id",
    "generated_source_operation_key",
    "is generated",
    "generated source type",
    "generated source document id",
    "generated source operation key",
  ]);
}

export function isMissingRenewalMonthsError(err: PgErrLike): boolean {
  return missingColumnMessage(errorMessage(err), ["renewal_months", "renewal months"]);
}

export function isMissingTrainingResourceColumnsError(err: PgErrLike): boolean {
  return missingColumnMessage(errorMessage(err), [
    "training_delivery_type",
    "training_resource_title",
    "training_resource_url",
    "training_resource_instructions",
    "training delivery type",
    "training resource title",
    "training resource url",
    "training resource instructions",
  ]);
}

function withResourceColumns(columns: string, includeResources: boolean): string {
  return includeResources ? `${columns}, ${COLS_RESOURCE}` : columns;
}

function selectFull(includeTimestamps: boolean, includeResources = true): string {
  const columns = includeTimestamps
    ? `${COLS_WITH_RENEWAL}, ${COLS_APPLY}, ${COLS_TASK_SCOPE}, ${COLS_GENERATED}, ${COLS_TS}`
    : `${COLS_WITH_RENEWAL}, ${COLS_APPLY}, ${COLS_TASK_SCOPE}, ${COLS_GENERATED}`;
  return withResourceColumns(columns, includeResources);
}

function selectFullNoRenewal(includeTimestamps: boolean, includeResources = true): string {
  const columns = includeTimestamps
    ? `${COLS_BASE}, ${COLS_APPLY}, ${COLS_TASK_SCOPE}, ${COLS_GENERATED}, ${COLS_TS}`
    : `${COLS_BASE}, ${COLS_APPLY}, ${COLS_TASK_SCOPE}, ${COLS_GENERATED}`;
  return withResourceColumns(columns, includeResources);
}

function selectScopeNoGenerated(includeTimestamps: boolean, includeResources = true): string {
  const columns = includeTimestamps
    ? `${COLS_WITH_RENEWAL}, ${COLS_APPLY}, ${COLS_TASK_SCOPE}, ${COLS_TS}`
    : `${COLS_WITH_RENEWAL}, ${COLS_APPLY}, ${COLS_TASK_SCOPE}`;
  return withResourceColumns(columns, includeResources);
}

function selectScopeNoGeneratedNoRenewal(includeTimestamps: boolean, includeResources = true): string {
  const columns = includeTimestamps
    ? `${COLS_BASE}, ${COLS_APPLY}, ${COLS_TASK_SCOPE}, ${COLS_TS}`
    : `${COLS_BASE}, ${COLS_APPLY}, ${COLS_TASK_SCOPE}`;
  return withResourceColumns(columns, includeResources);
}

function selectBasicApply(includeTimestamps: boolean, includeResources = true): string {
  const columns = includeTimestamps
    ? `${COLS_WITH_RENEWAL}, ${COLS_APPLY}, ${COLS_TS}`
    : `${COLS_WITH_RENEWAL}, ${COLS_APPLY}`;
  return withResourceColumns(columns, includeResources);
}

function selectBasicApplyNoRenewal(includeTimestamps: boolean, includeResources = true): string {
  const columns = includeTimestamps
    ? `${COLS_BASE}, ${COLS_APPLY}, ${COLS_TS}`
    : `${COLS_BASE}, ${COLS_APPLY}`;
  return withResourceColumns(columns, includeResources);
}

function selectLegacy(includeTimestamps: boolean, includeResources = true): string {
  const columns = includeTimestamps ? `${COLS_BASE}, ${COLS_TS}` : COLS_BASE;
  return withResourceColumns(columns, includeResources);
}

function selectLegacyWithRenewal(includeTimestamps: boolean, includeResources = true): string {
  const columns = includeTimestamps ? `${COLS_WITH_RENEWAL}, ${COLS_TS}` : COLS_WITH_RENEWAL;
  return withResourceColumns(columns, includeResources);
}

export function selectReturnFull(includeResources = true): string {
  return selectFull(true, includeResources);
}

export function selectReturnFullNoRenewal(includeResources = true): string {
  return selectFullNoRenewal(true, includeResources);
}

export function selectReturnScopeNoGenerated(includeResources = true): string {
  return selectScopeNoGenerated(true, includeResources);
}

export function selectReturnScopeNoGeneratedNoRenewal(includeResources = true): string {
  return selectScopeNoGeneratedNoRenewal(true, includeResources);
}

export function selectReturnBasicApply(includeResources = true): string {
  return selectBasicApply(true, includeResources);
}

export function selectReturnBasicApplyNoRenewal(includeResources = true): string {
  return selectBasicApplyNoRenewal(true, includeResources);
}

export function selectReturnLegacy(includeResources = true): string {
  return selectLegacy(true, includeResources);
}

export function selectReturnLegacyWithRenewal(includeResources = true): string {
  return selectLegacyWithRenewal(true, includeResources);
}

function trainingRequirementSelectAttempts(includeTimestamps: boolean) {
  const shapes: Array<{
    columns: string;
    applyColumnsAvailable: boolean;
    taskScopeColumnsAvailable: boolean;
    generatedColumnsAvailable: boolean;
    renewalAvailable: boolean;
  }> = [
    {
      columns: selectFull(includeTimestamps, false),
      applyColumnsAvailable: true,
      taskScopeColumnsAvailable: true,
      generatedColumnsAvailable: true,
      renewalAvailable: true,
    },
    {
      columns: selectFullNoRenewal(includeTimestamps, false),
      applyColumnsAvailable: true,
      taskScopeColumnsAvailable: true,
      generatedColumnsAvailable: true,
      renewalAvailable: false,
    },
    {
      columns: selectScopeNoGenerated(includeTimestamps, false),
      applyColumnsAvailable: true,
      taskScopeColumnsAvailable: true,
      generatedColumnsAvailable: false,
      renewalAvailable: true,
    },
    {
      columns: selectScopeNoGeneratedNoRenewal(includeTimestamps, false),
      applyColumnsAvailable: true,
      taskScopeColumnsAvailable: true,
      generatedColumnsAvailable: false,
      renewalAvailable: false,
    },
    {
      columns: selectBasicApply(includeTimestamps, false),
      applyColumnsAvailable: true,
      taskScopeColumnsAvailable: false,
      generatedColumnsAvailable: false,
      renewalAvailable: true,
    },
    {
      columns: selectBasicApplyNoRenewal(includeTimestamps, false),
      applyColumnsAvailable: true,
      taskScopeColumnsAvailable: false,
      generatedColumnsAvailable: false,
      renewalAvailable: false,
    },
    {
      columns: selectLegacyWithRenewal(includeTimestamps, false),
      applyColumnsAvailable: false,
      taskScopeColumnsAvailable: false,
      generatedColumnsAvailable: false,
      renewalAvailable: true,
    },
    {
      columns: selectLegacy(includeTimestamps, false),
      applyColumnsAvailable: false,
      taskScopeColumnsAvailable: false,
      generatedColumnsAvailable: false,
      renewalAvailable: false,
    },
  ];

  return [
    ...shapes.map((shape) => ({
      ...shape,
      columns: withResourceColumns(shape.columns, true),
      resourceColumnsAvailable: true,
    })),
    ...shapes.map((shape) => ({
      ...shape,
      resourceColumnsAvailable: false,
    })),
  ];
}

function normalizeRequirementRows(
  raw: TrainingRequirementDbRow[],
  flags: {
    applyColumnsAvailable: boolean;
    taskScopeColumnsAvailable: boolean;
    generatedColumnsAvailable: boolean;
    renewalAvailable: boolean;
    resourceColumnsAvailable: boolean;
  }
): TrainingRequirementDbRow[] {
  return raw.map((row) => ({
    ...row,
    apply_trades: flags.applyColumnsAvailable ? row.apply_trades ?? [] : [],
    apply_positions: flags.applyColumnsAvailable ? row.apply_positions ?? [] : [],
    apply_sub_trades: flags.taskScopeColumnsAvailable ? row.apply_sub_trades ?? [] : [],
    apply_task_codes: flags.taskScopeColumnsAvailable ? row.apply_task_codes ?? [] : [],
    renewal_months: flags.renewalAvailable ? row.renewal_months ?? null : null,
    is_generated: flags.generatedColumnsAvailable ? row.is_generated ?? false : false,
    generated_source_type: flags.generatedColumnsAvailable ? row.generated_source_type ?? null : null,
    generated_source_document_id: flags.generatedColumnsAvailable
      ? row.generated_source_document_id ?? null
      : null,
    generated_source_operation_key: flags.generatedColumnsAvailable
      ? row.generated_source_operation_key ?? null
      : null,
    training_delivery_type: flags.resourceColumnsAvailable ? row.training_delivery_type ?? null : null,
    training_resource_title: flags.resourceColumnsAvailable ? row.training_resource_title ?? null : null,
    training_resource_url: flags.resourceColumnsAvailable ? row.training_resource_url ?? null : null,
    training_resource_instructions: flags.resourceColumnsAvailable
      ? row.training_resource_instructions ?? null
      : null,
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
  taskScopeColumnsAvailable: boolean;
  generatedColumnsAvailable: boolean;
}> {
  const trySelect = async (columns: string) =>
    supabase
      .from("company_training_requirements")
      .select(columns)
      .eq("company_id", companyId)
      .order("sort_order", { ascending: true });

  const attempts = trainingRequirementSelectAttempts(includeTimestamps);

  let lastMessage = "Failed to load training requirements.";
  for (const attempt of attempts) {
    const res = await trySelect(attempt.columns);
    if (!res.error) {
      const raw = (res.data ?? []) as unknown as TrainingRequirementDbRow[];
      return {
        rows: normalizeRequirementRows(raw, attempt),
        error: null,
        applyColumnsAvailable: attempt.applyColumnsAvailable,
        taskScopeColumnsAvailable: attempt.taskScopeColumnsAvailable,
        generatedColumnsAvailable: attempt.generatedColumnsAvailable,
      };
    }

    lastMessage = res.error.message || lastMessage;
    const missingKnownColumns =
      isMissingApplyColumnsError(res.error) ||
      isMissingTaskScopeColumnsError(res.error) ||
      isMissingGeneratedColumnsError(res.error) ||
      isMissingRenewalMonthsError(res.error) ||
      isMissingTrainingResourceColumnsError(res.error);

    if (!missingKnownColumns) {
      return {
        rows: [],
        error: lastMessage,
        applyColumnsAvailable: true,
        taskScopeColumnsAvailable: true,
        generatedColumnsAvailable: true,
      };
    }
  }

  return {
    rows: [],
    error: lastMessage,
    applyColumnsAvailable: false,
    taskScopeColumnsAvailable: false,
    generatedColumnsAvailable: false,
  };
}

export async function fetchTrainingRequirementById(
  supabase: SupabaseClient,
  id: string
): Promise<{
  row: TrainingRequirementDbRow | null;
  error: string | null;
  applyColumnsAvailable: boolean;
  taskScopeColumnsAvailable: boolean;
  generatedColumnsAvailable: boolean;
  renewalMonthsAvailable: boolean;
  resourceColumnsAvailable: boolean;
}> {
  const attempts = trainingRequirementSelectAttempts(false);

  let lastMessage = "Failed to load requirement.";
  for (const attempt of attempts) {
    const res = await supabase
      .from("company_training_requirements")
      .select(attempt.columns)
      .eq("id", id)
      .maybeSingle();

    if (!res.error) {
      const raw = res.data as TrainingRequirementDbRow | null;
      if (!raw) {
        return {
          row: null,
          error: null,
          applyColumnsAvailable: attempt.applyColumnsAvailable,
          taskScopeColumnsAvailable: attempt.taskScopeColumnsAvailable,
          generatedColumnsAvailable: attempt.generatedColumnsAvailable,
          renewalMonthsAvailable: attempt.renewalAvailable,
          resourceColumnsAvailable: attempt.resourceColumnsAvailable,
        };
      }

      const row = normalizeRequirementRows([raw], attempt)[0];
      return {
        row,
        error: null,
        applyColumnsAvailable: attempt.applyColumnsAvailable,
        taskScopeColumnsAvailable: attempt.taskScopeColumnsAvailable,
        generatedColumnsAvailable: attempt.generatedColumnsAvailable,
        renewalMonthsAvailable: attempt.renewalAvailable,
        resourceColumnsAvailable: attempt.resourceColumnsAvailable,
      };
    }

    lastMessage = res.error.message || lastMessage;
    const missingKnownColumns =
      isMissingApplyColumnsError(res.error) ||
      isMissingTaskScopeColumnsError(res.error) ||
      isMissingGeneratedColumnsError(res.error) ||
      isMissingRenewalMonthsError(res.error) ||
      isMissingTrainingResourceColumnsError(res.error);

    if (!missingKnownColumns) {
      return {
        row: null,
        error: lastMessage,
        applyColumnsAvailable: true,
        taskScopeColumnsAvailable: true,
        generatedColumnsAvailable: true,
        renewalMonthsAvailable: true,
        resourceColumnsAvailable: true,
      };
    }
  }

  return {
    row: null,
    error: lastMessage,
    applyColumnsAvailable: false,
    taskScopeColumnsAvailable: false,
    generatedColumnsAvailable: false,
    renewalMonthsAvailable: false,
    resourceColumnsAvailable: false,
  };
}
