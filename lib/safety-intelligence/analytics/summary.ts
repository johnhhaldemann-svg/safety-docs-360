import type { SupabaseClient } from "@supabase/supabase-js";
import type { SafetyIntelligenceDashboardSummary } from "@/lib/safety-intelligence/contracts";

type LiteClient = SupabaseClient<any, "public", any>;

export async function buildSafetyIntelligenceSummary(
  supabase: LiteClient,
  companyId: string,
  jobsiteId?: string | null
): Promise<SafetyIntelligenceDashboardSummary> {
  const batchesQuery = supabase.from("ai_knowledge_ingest_batches").select("id", { count: "exact", head: true }).eq("company_id", companyId);
  let aiReviewsQuery = supabase.from("company_ai_reviews").select("id", { count: "exact", head: true }).eq("company_id", companyId);
  let conflictsQuery = supabase
    .from("company_conflict_pairs")
    .select("id, conflict_code, severity, rationale", { count: "exact" })
    .eq("company_id", companyId)
    .eq("status", "open")
    .order("updated_at", { ascending: false })
    .limit(6);
  let docsQuery = supabase.from("company_generated_documents").select("id", { count: "exact", head: true }).eq("company_id", companyId);
  let tasksQuery = supabase
    .from("company_tasks")
    .select("code, title, hazard_families")
    .eq("company_id", companyId)
    .order("updated_at", { ascending: false })
    .limit(50);

  if (jobsiteId) {
    aiReviewsQuery = aiReviewsQuery.eq("jobsite_id", jobsiteId);
    conflictsQuery = conflictsQuery.eq("jobsite_id", jobsiteId);
    docsQuery = docsQuery.eq("jobsite_id", jobsiteId);
    tasksQuery = tasksQuery.eq("jobsite_id", jobsiteId);
  }

  const [batches, aiReviews, conflicts, docs, tasks] = await Promise.all([
    batchesQuery,
    aiReviewsQuery,
    conflictsQuery,
    docsQuery,
    tasksQuery,
  ]);

  const tradeCounts = new Map<string, number>();
  const hazardCounts = new Map<string, number>();

  for (const row of (tasks.data ?? []) as Array<Record<string, unknown>>) {
    const code = String(row.code ?? row.title ?? "unknown").trim();
    tradeCounts.set(code, (tradeCounts.get(code) ?? 0) + 1);
    for (const hazard of (row.hazard_families ?? []) as string[]) {
      hazardCounts.set(hazard, (hazardCounts.get(hazard) ?? 0) + 1);
    }
  }

  return {
    totals: {
      bucketRuns: batches.count ?? 0,
      aiReviews: aiReviews.count ?? 0,
      openConflicts: conflicts.count ?? 0,
      generatedDocuments: docs.count ?? 0,
    },
    topTrades: [...tradeCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([code, count]) => ({ code, count })),
    topHazards: [...hazardCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([code, count]) => ({ code, count })),
    openConflictItems: ((conflicts.data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      id: String(row.id),
      title: String(row.conflict_code).replace(/_/g, " "),
      severity: String(row.severity),
      rationale: String(row.rationale),
    })),
  };
}
