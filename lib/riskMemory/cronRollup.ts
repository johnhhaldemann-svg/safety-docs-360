import { companyHasCsepPlanName } from "@/lib/csepApiGuard";
import { buildLlmRiskRecommendations } from "@/lib/riskMemory/llmRecommendations";
import { buildRuleBasedRiskRecommendations, type RiskRecommendationDraft } from "@/lib/riskMemory/recommendations";
import { upsertCompanyRiskScoreFromContext } from "@/lib/riskMemory/scoresRepo";
import { buildRiskMemoryStructuredContext } from "@/lib/riskMemory/structuredContext";
import { serverLog } from "@/lib/serverLog";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export type RiskMemoryCronResult = {
  ok: boolean;
  error?: string;
  snapshotDate: string;
  snapshotUpserts: number;
  /** Successful upserts into `company_risk_scores` (one per company per day). */
  riskScoreUpserts: number;
  riskScoreFailed: number;
  recommendationsInserted: number;
  /** LLM-generated drafts inserted (subset of `recommendationsInserted`). */
  llmRecommendationsInserted: number;
  /** Companies the LLM path was eligible to run for (after allowlist + cap). */
  llmCompaniesProcessed: number;
  llmCompaniesFailed: number;
  llmEnabled: boolean;
  companiesSkipped: number;
  companiesFailed: number;
  companiesSeen: number;
};

function readMaxCompanies(): number {
  const raw = Number(process.env.RISK_MEMORY_CRON_MAX_COMPANIES);
  if (Number.isFinite(raw) && raw > 0) return Math.min(2000, Math.floor(raw));
  return 300;
}

/** Daily cap on LLM cron generations to keep spend bounded. */
function readLlmMaxCompanies(): number {
  const raw = Number(process.env.RISK_MEMORY_LLM_CRON_MAX_COMPANIES);
  if (Number.isFinite(raw) && raw > 0) return Math.min(500, Math.floor(raw));
  return 25;
}

/** `RISK_MEMORY_LLM_CRON=1` enables the LLM path; off by default for cost safety. */
export function isRiskMemoryLlmCronEnabled(): boolean {
  return process.env.RISK_MEMORY_LLM_CRON?.trim() === "1";
}

/** Optional CSV allowlist `RISK_MEMORY_LLM_COMPANY_IDS=uuid,uuid,...`. Empty = all eligible. */
export function readRiskMemoryLlmCompanyAllowlist(): Set<string> {
  const raw = process.env.RISK_MEMORY_LLM_COMPANY_IDS?.trim();
  if (!raw) return new Set();
  return new Set(
    raw
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
  );
}

/**
 * Nightly (or manual) job: persist `company_risk_memory_snapshots` per company using the service role.
 * Optionally append rule-based recommendations with 7-day title dedupe.
 *
 * Set `includeLlmRecommendations: true` (or env `RISK_MEMORY_LLM_CRON=1`) to also call the
 * LLM path for top-N companies (capped by `RISK_MEMORY_LLM_CRON_MAX_COMPANIES`, default 25),
 * optionally restricted to `RISK_MEMORY_LLM_COMPANY_IDS`. Costs are bounded by both caps.
 */
export async function runRiskMemoryCronJob(input: {
  windowDays?: number;
  includeRecommendations?: boolean;
  /** Include LLM-generated recommendations for the eligible subset of companies. */
  includeLlmRecommendations?: boolean;
  maxCompanies?: number;
  /** Override the LLM-companies cap (test override; clamped to 0..500). */
  llmMaxCompanies?: number;
  /** Override the allowlist (test override). Empty set = all eligible. */
  llmAllowlist?: Set<string>;
}): Promise<RiskMemoryCronResult> {
  const snapshotDate = new Date().toISOString().slice(0, 10);
  const llmEnabled = Boolean(input.includeLlmRecommendations) || isRiskMemoryLlmCronEnabled();
  const empty = (): RiskMemoryCronResult => ({
    ok: false,
    snapshotDate,
    snapshotUpserts: 0,
    riskScoreUpserts: 0,
    riskScoreFailed: 0,
    recommendationsInserted: 0,
    llmRecommendationsInserted: 0,
    llmCompaniesProcessed: 0,
    llmCompaniesFailed: 0,
    llmEnabled,
    companiesSkipped: 0,
    companiesFailed: 0,
    companiesSeen: 0,
  });

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { ...empty(), error: "Missing Supabase URL or service role key." };
  }

  const windowDays = Math.min(365, Math.max(1, input.windowDays ?? 90));
  const maxCompanies = input.maxCompanies ?? readMaxCompanies();
  const includeRecs = Boolean(input.includeRecommendations) || llmEnabled;
  const llmAllowlist = input.llmAllowlist ?? readRiskMemoryLlmCompanyAllowlist();
  const llmCompaniesCap = Math.max(
    0,
    Math.min(500, Math.floor(input.llmMaxCompanies ?? readLlmMaxCompanies()))
  );

  const listRes = await admin
    .from("companies")
    .select("id")
    .order("id", { ascending: true })
    .limit(maxCompanies);

  if (listRes.error) {
    return { ...empty(), error: listRes.error.message ?? "Failed to list companies." };
  }

  const companyRows = (listRes.data ?? []) as { id: string }[];
  let snapshotUpserts = 0;
  let riskScoreUpserts = 0;
  let riskScoreFailed = 0;
  let recommendationsInserted = 0;
  let llmRecommendationsInserted = 0;
  let llmCompaniesProcessed = 0;
  let llmCompaniesFailed = 0;
  let companiesSkipped = 0;
  let companiesFailed = 0;

  for (const row of companyRows) {
    const companyId = String(row.id);
    try {
      if (await companyHasCsepPlanName(admin, companyId)) {
        companiesSkipped += 1;
        continue;
      }

      const ctx = await buildRiskMemoryStructuredContext(admin, companyId, { days: windowDays });
      const metrics =
        ctx ??
        ({
          engine: "Safety360 Risk Memory Engine",
          note: "no_facet_context",
          windowDays,
        } as Record<string, unknown>);

      const snap = await admin.from("company_risk_memory_snapshots").upsert(
        {
          company_id: companyId,
          jobsite_id: null,
          snapshot_date: snapshotDate,
          metrics,
          created_by: null,
        },
        { onConflict: "company_id,jobsite_id,snapshot_date" }
      );

      if (snap.error) {
        const msg = (snap.error.message ?? "").toLowerCase();
        if (msg.includes("company_risk_memory_snapshots") || msg.includes("schema cache")) {
          companiesSkipped += 1;
          serverLog("warn", "risk_memory_cron_snapshot_skipped", {
            companyId,
            message: (snap.error.message ?? "").slice(0, 180),
          });
        } else {
          companiesFailed += 1;
          serverLog("warn", "risk_memory_cron_snapshot_failed", {
            companyId,
            message: (snap.error.message ?? "").slice(0, 180),
          });
        }
        continue;
      }

      snapshotUpserts += 1;

      if (ctx) {
        try {
          const scoreRes = await upsertCompanyRiskScoreFromContext({
            admin,
            companyId,
            ctx,
            scoreDate: snapshotDate,
          });
          if (scoreRes.ok) {
            riskScoreUpserts += 1;
          } else {
            riskScoreFailed += 1;
            const msg = (scoreRes.error ?? "").toLowerCase();
            const level = msg.includes("company_risk_scores") || msg.includes("schema cache") ? "info" : "warn";
            serverLog(level, "risk_memory_cron_score_upsert_failed", {
              companyId,
              message: (scoreRes.error ?? "").slice(0, 180),
            });
          }
        } catch (e) {
          riskScoreFailed += 1;
          serverLog("warn", "risk_memory_cron_score_upsert_exception", {
            companyId,
            message: e instanceof Error ? e.message.slice(0, 180) : "unknown",
          });
        }
      }

      if (includeRecs && ctx) {
        const ruleDrafts = buildRuleBasedRiskRecommendations(ctx);
        const wantLlm =
          llmEnabled &&
          llmCompaniesProcessed < llmCompaniesCap &&
          (llmAllowlist.size === 0 || llmAllowlist.has(companyId));

        let llmDrafts: RiskRecommendationDraft[] = [];
        if (wantLlm) {
          llmCompaniesProcessed += 1;
          try {
            const res = await buildLlmRiskRecommendations(ctx);
            if (res.error) {
              llmCompaniesFailed += 1;
              serverLog("warn", "risk_memory_cron_llm_failed", {
                companyId,
                error: res.error,
                model: res.meta?.model ?? null,
              });
            }
            llmDrafts = res.drafts;
          } catch (e) {
            llmCompaniesFailed += 1;
            serverLog("warn", "risk_memory_cron_llm_exception", {
              companyId,
              message: e instanceof Error ? e.message.slice(0, 180) : "unknown",
            });
          }
        }

        if (ruleDrafts.length === 0 && llmDrafts.length === 0) continue;

        const since = new Date(Date.now() - 7 * 86400000).toISOString();
        const existing = await admin
          .from("company_risk_ai_recommendations")
          .select("title")
          .eq("company_id", companyId)
          .gte("created_at", since);

        if (existing.error) {
          serverLog("warn", "risk_memory_cron_recommendations_list_failed", {
            companyId,
            message: (existing.error.message ?? "").slice(0, 180),
          });
          continue;
        }

        const titles = new Set(
          (existing.data ?? []).map((r: { title?: string | null }) => String(r.title ?? "").trim())
        );

        const dedupeAcrossBatch = new Set<string>();
        const ruleToInsert = ruleDrafts.filter((d) => {
          if (!d.title || titles.has(d.title) || dedupeAcrossBatch.has(d.title)) return false;
          dedupeAcrossBatch.add(d.title);
          return true;
        });
        const llmToInsert = llmDrafts.filter((d) => {
          if (!d.title || titles.has(d.title) || dedupeAcrossBatch.has(d.title)) return false;
          dedupeAcrossBatch.add(d.title);
          return true;
        });
        if (ruleToInsert.length === 0 && llmToInsert.length === 0) continue;

        const baseContextSnapshot = {
          engine: ctx.engine,
          windowDays: ctx.windowDays,
          facetCount: ctx.facetCount,
          band: ctx.aggregatedWithBaseline?.band ?? ctx.aggregated.band,
          score: ctx.aggregatedWithBaseline?.score ?? ctx.aggregated.score,
        };

        const rows = [
          ...ruleToInsert.map((d) => ({
            company_id: companyId,
            jobsite_id: null,
            kind: d.kind,
            title: d.title,
            body: d.body,
            confidence: d.confidence,
            context_snapshot: { ...baseContextSnapshot, source: "cron", generator: "rules" },
            created_by: null,
          })),
          ...llmToInsert.map((d) => ({
            company_id: companyId,
            jobsite_id: null,
            kind: d.kind,
            title: d.title,
            body: d.body,
            confidence: d.confidence,
            context_snapshot: { ...baseContextSnapshot, source: "cron", generator: "llm" },
            created_by: null,
          })),
        ];

        const ins = await admin.from("company_risk_ai_recommendations").insert(rows);

        if (ins.error) {
          serverLog("warn", "risk_memory_cron_recommendations_insert_failed", {
            companyId,
            message: (ins.error.message ?? "").slice(0, 180),
          });
        } else {
          recommendationsInserted += rows.length;
          llmRecommendationsInserted += llmToInsert.length;
        }
      }
    } catch (e) {
      companiesFailed += 1;
      serverLog("warn", "risk_memory_cron_company_failed", {
        companyId,
        message: e instanceof Error ? e.message.slice(0, 180) : "unknown",
      });
    }
  }

  return {
    ok: true,
    snapshotDate,
    snapshotUpserts,
    riskScoreUpserts,
    riskScoreFailed,
    recommendationsInserted,
    llmRecommendationsInserted,
    llmCompaniesProcessed,
    llmCompaniesFailed,
    llmEnabled,
    companiesSkipped,
    companiesFailed,
    companiesSeen: companyRows.length,
  };
}
