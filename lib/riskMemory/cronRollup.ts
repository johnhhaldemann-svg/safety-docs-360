import { companyHasCsepPlanName } from "@/lib/csepApiGuard";
import { buildRuleBasedRiskRecommendations } from "@/lib/riskMemory/recommendations";
import { buildRiskMemoryStructuredContext } from "@/lib/riskMemory/structuredContext";
import { serverLog } from "@/lib/serverLog";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export type RiskMemoryCronResult = {
  ok: boolean;
  error?: string;
  snapshotDate: string;
  snapshotUpserts: number;
  recommendationsInserted: number;
  companiesSkipped: number;
  companiesFailed: number;
  companiesSeen: number;
};

function readMaxCompanies(): number {
  const raw = Number(process.env.RISK_MEMORY_CRON_MAX_COMPANIES);
  if (Number.isFinite(raw) && raw > 0) return Math.min(2000, Math.floor(raw));
  return 300;
}

/**
 * Nightly (or manual) job: persist `company_risk_memory_snapshots` per company using the service role.
 * Optionally append rule-based recommendations with 7-day title dedupe.
 */
export async function runRiskMemoryCronJob(input: {
  windowDays?: number;
  includeRecommendations?: boolean;
  maxCompanies?: number;
}): Promise<RiskMemoryCronResult> {
  const snapshotDate = new Date().toISOString().slice(0, 10);
  const empty = (): RiskMemoryCronResult => ({
    ok: false,
    snapshotDate,
    snapshotUpserts: 0,
    recommendationsInserted: 0,
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
  const includeRecs = Boolean(input.includeRecommendations);

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
  let recommendationsInserted = 0;
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

      if (includeRecs && ctx) {
        const drafts = buildRuleBasedRiskRecommendations(ctx);
        if (drafts.length === 0) continue;

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
        const toInsert = drafts.filter((d) => d.title && !titles.has(d.title));
        if (toInsert.length === 0) continue;

        const contextSnapshot = {
          engine: ctx.engine,
          windowDays: ctx.windowDays,
          facetCount: ctx.facetCount,
          band: ctx.aggregatedWithBaseline?.band ?? ctx.aggregated.band,
          score: ctx.aggregatedWithBaseline?.score ?? ctx.aggregated.score,
          source: "cron",
        };

        const ins = await admin.from("company_risk_ai_recommendations").insert(
          toInsert.map((d) => ({
            company_id: companyId,
            jobsite_id: null,
            kind: d.kind,
            title: d.title,
            body: d.body,
            confidence: d.confidence,
            context_snapshot: contextSnapshot,
            created_by: null,
          }))
        );

        if (ins.error) {
          serverLog("warn", "risk_memory_cron_recommendations_insert_failed", {
            companyId,
            message: (ins.error.message ?? "").slice(0, 180),
          });
        } else {
          recommendationsInserted += toInsert.length;
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
    recommendationsInserted,
    companiesSkipped,
    companiesFailed,
    companiesSeen: companyRows.length,
  };
}
