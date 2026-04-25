/**
 * Risk Memory Engine — Phase 2 reference (planning / tickets).
 * Not loaded by runtime paths.
 */

/** Shipped in repo (apply matching Supabase migrations in target envs). */
export const RISK_MEMORY_PHASE2_SHIPPED = [
  "company_contractors + facet.contractor_id FK",
  "Facet columns: behavior_category, training_status, supervision_status, equipment_type, cost_impact_band, forecast_confidence, location_grid",
  "company_risk_ai_recommendations + GET list + POST rule-based generate",
  "company_risk_memory_snapshots POST helper for daily rollup persistence",
  "Analytics summary includes riskMemoryRecommendations; UI on /analytics",
  "GET/POST /api/company/contractors for directory + Risk Memory picker",
  "company_crews + facet.crew_id; GET/POST /api/company/crews; jobsite-filtered crew picker on field reports",
  "GET /api/cron/risk-memory-rollup (Vercel daily) — snapshots; ?recommendations=1 for deduped rule-based inserts",
  "GET /api/cron/risk-memory-rollup ?llm=1 (or env RISK_MEMORY_LLM_CRON=1) — cost-controlled LLM recommendations with company allowlist + daily cap",
  "Structured context: topLocationGrids, topLocationAreas, derivedRollupConfidence; rule hotspot + POST generate mode=both (OpenAI)",
  "/settings/risk-memory UI + nav; PATCH dismiss recommendations; facet query fallback without Phase-2 location columns",
] as const;

/** Still open or stretch goals. */
export const RISK_MEMORY_PHASE2_BACKLOG = [
  "Full forecast models beyond heuristic rollup confidence",
  "Interactive map / GIS wired to location_grid",
  "Admin CRUD for taxonomy terms without deploys (risk_taxonomy_terms)",
] as const;
