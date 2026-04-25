-- Activate the dormant `public.company_risk_scores` table by allowing one
-- company-scope row per (company_id, score_date). The Risk Memory daily cron
-- (lib/riskMemory/cronRollup.ts) writes this row so the analytics dashboard can
-- show a 30-day sparkline + delta without recomputing from facets at read time.

-- Partial unique index: only enforces on `score_scope='company'` rows with
-- jobsite/bucket dimensions null. Per-jobsite, per-trade, etc. rows can still
-- be inserted by other workflows without conflict.
create unique index if not exists company_risk_scores_company_daily_uidx
  on public.company_risk_scores (company_id, score_date)
  where score_scope = 'company'
    and jobsite_id is null
    and bucket_run_id is null
    and bucket_item_id is null
    and trade_code is null
    and task_code is null
    and work_area_id is null;
