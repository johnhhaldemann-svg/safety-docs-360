import type { SupabaseClient } from "@supabase/supabase-js";
import type { NormalizedLiveSignalRow } from "@/lib/injuryWeather/types";
import {
  DEFAULT_PREDICTABILITY_SETTINGS,
  normalizePredictabilitySettings,
  type PredictabilitySettings,
} from "@/lib/predictability/settings";
import type {
  PlatformAggregateMaturity,
  PredictabilityDataThresholds,
  PredictabilityMaturity,
} from "@/lib/predictability/dataSourceResolver";

type SupabaseLike = Pick<SupabaseClient, "from">;

type QueryChain<T> = PromiseLike<T> & {
  select: (columns: string, options?: Record<string, unknown>) => QueryChain<T>;
  eq: (column: string, value: string | boolean | number) => QueryChain<T>;
  neq: (column: string, value: string | boolean | number) => QueryChain<T>;
  gte: (column: string, value: string | number) => QueryChain<T>;
  order: (column: string, options?: Record<string, unknown>) => QueryChain<T>;
  limit: (count: number) => QueryChain<T>;
  update: (values: Record<string, unknown>) => QueryChain<T>;
  maybeSingle: () => PromiseLike<T>;
};

function fromTable<T>(supabase: SupabaseLike, table: string): QueryChain<T> {
  return supabase.from(table) as unknown as QueryChain<T>;
}

type CountedRowsResult = {
  data?: Array<{ created_at?: string | null }> | null;
  count?: number | null;
  error?: { message?: string | null } | null;
};

type PlatformAggregateRow = {
  industry?: string | null;
  company_size_bucket?: string | null;
  region?: string | null;
  incident_type?: string | null;
  job_type?: string | null;
  time_period?: string | null;
  record_count?: number | null;
  company_count?: number | null;
  observation_days?: number | null;
  risk_score?: number | null;
  updated_at?: string | null;
};

function isMissingTableError(message?: string | null): boolean {
  const normalized = String(message ?? "").toLowerCase();
  return normalized.includes("does not exist") || normalized.includes("schema cache") || normalized.includes("could not find");
}

function observationDays(rows: Array<{ created_at?: string | null }>): number {
  const times = rows
    .map((row) => new Date(String(row.created_at ?? "")).getTime())
    .filter((time) => Number.isFinite(time));
  if (times.length <= 1) return times.length > 0 ? 1 : 0;
  return Math.max(1, Math.ceil((Math.max(...times) - Math.min(...times)) / 86400000));
}

async function getCompanyTableMaturity(
  supabase: SupabaseLike,
  table: "company_sor_records" | "company_corrective_actions" | "company_incidents",
  companyId: string
): Promise<PredictabilityMaturity> {
  let query = fromTable<CountedRowsResult>(supabase, table)
    .select("created_at", { count: "exact" })
    .eq("company_id", companyId)
    .neq("prediction_validation_status", "rejected");

  if (table === "company_sor_records") {
    query = query.eq("is_deleted", false);
  }

  const result = (await query) as CountedRowsResult;
  if (result.error) return { recordCount: 0, observationDays: 0 };
  const rows = result.data ?? [];
  return {
    recordCount: Number(result.count ?? rows.length ?? 0),
    observationDays: observationDays(rows),
  };
}

export async function getCompanyPredictabilityMaturity(
  supabase: SupabaseLike,
  companyId: string
): Promise<PredictabilityMaturity> {
  const [sor, corrective, incidents] = await Promise.all([
    getCompanyTableMaturity(supabase, "company_sor_records", companyId),
    getCompanyTableMaturity(supabase, "company_corrective_actions", companyId),
    getCompanyTableMaturity(supabase, "company_incidents", companyId),
  ]);

  return {
    recordCount: sor.recordCount + corrective.recordCount + incidents.recordCount,
    observationDays: Math.max(sor.observationDays, corrective.observationDays, incidents.observationDays),
  };
}

export async function getPlatformAggregateMaturity(
  supabase: SupabaseLike,
  thresholds: Pick<PredictabilityDataThresholds, "minPlatformAggregateCompanies">
): Promise<PlatformAggregateMaturity> {
  const result = (await fromTable<{
    data?: Array<Pick<PlatformAggregateRow, "record_count" | "company_count" | "observation_days">> | null;
    error?: { message?: string | null } | null;
  }>(supabase, "platform_predictability_aggregates")
    .select("record_count, company_count, observation_days")
    .gte("company_count", thresholds.minPlatformAggregateCompanies));

  if (result.error) {
    if (!isMissingTableError(result.error.message)) {
      console.warn("[predictability] platform aggregate maturity query failed:", result.error.message);
    }
    return { recordCount: 0, companyCount: 0, observationDays: 0 };
  }

  const safeRows = result.data ?? [];
  return {
    recordCount: safeRows.reduce((sum, row) => sum + Number(row.record_count ?? 0), 0),
    companyCount: safeRows.reduce((max, row) => Math.max(max, Number(row.company_count ?? 0)), 0),
    observationDays: safeRows.reduce((max, row) => Math.max(max, Number(row.observation_days ?? 0)), 0),
  };
}

function safeCategory(row: PlatformAggregateRow): string {
  const incident = String(row.incident_type ?? "").trim();
  if (incident) return incident;
  const job = String(row.job_type ?? "").trim();
  return job || "Aggregate safety benchmark";
}

function safeTrade(row: PlatformAggregateRow): string {
  const job = String(row.job_type ?? "").trim();
  if (job) return job;
  const industry = String(row.industry ?? "").trim();
  return industry || "Platform construction benchmark";
}

function severityFromRiskScore(value: number | null | undefined): NormalizedLiveSignalRow["severity"] {
  const score = Number(value ?? 0);
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  return "low";
}

function dateFromTimePeriod(value: string | null | undefined, index: number): string {
  const parsed = new Date(String(value ?? ""));
  const base = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  return new Date(base.getFullYear(), Math.max(0, base.getMonth() - index), 1).toISOString();
}

export function rowsFromPlatformAggregates(
  aggregates: PlatformAggregateRow[],
  thresholds: Pick<PredictabilityDataThresholds, "minPlatformAggregateCompanies">,
  options?: { maxRows?: number }
): NormalizedLiveSignalRow[] {
  const rows: NormalizedLiveSignalRow[] = [];
  const maxRows = Math.max(1, Math.min(120, options?.maxRows ?? 72));
  for (const aggregate of aggregates) {
    if (Number(aggregate.company_count ?? 0) < thresholds.minPlatformAggregateCompanies) continue;
    const recordCount = Math.max(1, Number(aggregate.record_count ?? 1));
    const copies = Math.max(1, Math.min(12, Math.round(recordCount / 50)));
    const category = safeCategory(aggregate);
    for (let i = 0; i < copies && rows.length < maxRows; i += 1) {
      rows.push({
        tradeId: safeTrade(aggregate).toLowerCase().replace(/[^a-z0-9]+/g, "_") || "platform_aggregate",
        tradeLabel: safeTrade(aggregate),
        categoryId: category.toLowerCase().replace(/[^a-z0-9]+/g, "_") || "aggregate_benchmark",
        categoryLabel: category,
        severity: severityFromRiskScore(aggregate.risk_score),
        created_at: dateFromTimePeriod(aggregate.time_period ?? aggregate.updated_at, i),
        source: "incident",
      });
    }
  }
  return rows;
}

export async function getPlatformAggregatePredictionRows(
  supabase: SupabaseLike,
  thresholds: Pick<PredictabilityDataThresholds, "minPlatformAggregateCompanies">,
  options?: { maxRows?: number }
): Promise<NormalizedLiveSignalRow[]> {
  const result = (await fromTable<{ data?: PlatformAggregateRow[] | null; error?: { message?: string | null } | null }>(
    supabase,
    "platform_predictability_aggregates"
  )
    .select(
      "industry, company_size_bucket, region, incident_type, job_type, time_period, record_count, company_count, observation_days, risk_score, updated_at"
    )
    .gte("company_count", thresholds.minPlatformAggregateCompanies)
    .order("record_count", { ascending: false })
    .limit(100));

  if (result.error) {
    if (!isMissingTableError(result.error.message)) {
      console.warn("[predictability] platform aggregate row query failed:", result.error.message);
    }
    return [];
  }

  return rowsFromPlatformAggregates(result.data ?? [], thresholds, options);
}

export async function loadCompanyPredictabilitySettings(
  supabase: SupabaseLike,
  companyId: string
): Promise<PredictabilitySettings> {
  const result = (await fromTable<{
    data?: { predictability_settings?: unknown } | null;
    error?: { message?: string | null } | null;
  }>(supabase, "companies")
    .select("predictability_settings")
    .eq("id", companyId)
    .maybeSingle());

  if (result.error) {
    if (!isMissingTableError(result.error.message)) {
      console.warn("[predictability] company settings query failed:", result.error.message);
    }
    return DEFAULT_PREDICTABILITY_SETTINGS;
  }

  return normalizePredictabilitySettings(result.data?.predictability_settings);
}

export async function updateCompanyPredictabilitySettings(
  supabase: SupabaseLike,
  companyId: string,
  settingsInput: unknown,
  updatedBy: string
): Promise<{ settings: PredictabilitySettings; error: string | null }> {
  const settings = normalizePredictabilitySettings(settingsInput);
  const result = (await fromTable<{
    data?: { predictability_settings?: unknown } | null;
    error?: { message?: string | null } | null;
  }>(supabase, "companies")
    .update({
      predictability_settings: settings,
      updated_by: updatedBy,
      updated_at: new Date().toISOString(),
    })
    .eq("id", companyId)
    .select("predictability_settings")
    .maybeSingle());

  if (result.error) {
    return { settings, error: result.error.message || "Failed to update Predictability Engine settings." };
  }

  return { settings: normalizePredictabilitySettings(result.data?.predictability_settings ?? settings), error: null };
}
