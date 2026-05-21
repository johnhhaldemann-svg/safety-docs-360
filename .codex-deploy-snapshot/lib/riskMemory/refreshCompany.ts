import type { SupabaseClient } from "@supabase/supabase-js";
import { upsertCompanyRiskScoreFromContext } from "@/lib/riskMemory/scoresRepo";
import { buildRiskMemoryStructuredContext } from "@/lib/riskMemory/structuredContext";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { serverLog } from "@/lib/serverLog";

/**
 * Inline refresh after field ingestion or AI review: snapshot + optional company risk score.
 * Uses the caller's Supabase client for snapshots (RLS). Score upsert uses service role when configured.
 */
export async function refreshRiskMemoryRollupForCompany(params: {
  supabase: SupabaseClient;
  companyId: string;
  jobsiteId?: string | null;
  windowDays?: number;
}): Promise<{ snapshotOk: boolean; scoreOk: boolean; error?: string }> {
  const windowDays = Math.min(365, Math.max(1, params.windowDays ?? 90));
  const snapshotDate = new Date().toISOString().slice(0, 10);

  let ctx;
  try {
    ctx = await buildRiskMemoryStructuredContext(params.supabase, params.companyId, {
      days: windowDays,
      jobsiteId: params.jobsiteId ?? null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "context_failed";
    serverLog("warn", "risk_memory_refresh_context_failed", { companyId: params.companyId, message: msg.slice(0, 200) });
    return { snapshotOk: false, scoreOk: false, error: msg };
  }

  const metrics =
    ctx ??
    ({
      engine: "Safety360 Risk Memory Engine",
      note: "no_facet_context",
      windowDays,
    } as Record<string, unknown>);

  const snap = await params.supabase.from("company_risk_memory_snapshots").upsert(
    {
      company_id: params.companyId,
      jobsite_id: params.jobsiteId ?? null,
      snapshot_date: snapshotDate,
      metrics,
      created_by: null,
    },
    { onConflict: "company_id,jobsite_id,snapshot_date" }
  );

  if (snap.error) {
    serverLog("warn", "risk_memory_refresh_snapshot_failed", {
      companyId: params.companyId,
      message: (snap.error.message ?? "").slice(0, 200),
    });
    return { snapshotOk: false, scoreOk: false, error: snap.error.message };
  }

  let scoreOk = false;
  if (ctx) {
    const admin = createSupabaseAdminClient();
    if (admin) {
      const scoreRes = await upsertCompanyRiskScoreFromContext({
        admin,
        companyId: params.companyId,
        ctx,
        scoreDate: snapshotDate,
      });
      scoreOk = scoreRes.ok;
      if (!scoreRes.ok) {
        serverLog("info", "risk_memory_refresh_score_skipped", {
          companyId: params.companyId,
          message: (scoreRes.error ?? "").slice(0, 160),
        });
      }
    }
  }

  return { snapshotOk: true, scoreOk };
}
