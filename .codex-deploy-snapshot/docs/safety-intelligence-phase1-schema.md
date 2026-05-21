# Safety Intelligence Phase 1 Schema

Phase 1 is centered on the database foundation for a multi-tenant safety intelligence platform in Supabase. The schema keeps the processing order deterministic:

`trade/task intake -> normalized company tables and bucket tables -> rules/conflict evaluation -> AI review -> generated documents and risk outputs`

## Files

- `supabase/migrations/20260415123000_safety_intelligence_platform.sql`
- `supabase/migrations/20260415124000_safety_intelligence_seed.sql`

## Multi-tenant model

- Platform-owned baseline libraries live in `platform_*` tables.
- Company-specific operational and override data live in `company_*` tables with required `company_id`.
- Jobsite-scoped records additionally include `jobsite_id` so the same company can run multiple sites in parallel.
- Shared reads flow from platform library tables first, then company overrides are layered on top in application logic.

## Core table groups

### Master trade and task libraries

- `platform_trades`
- `platform_sub_trades`
- `platform_task_templates`
- `company_trades`
- `company_sub_trades`
- `company_tasks`

These support baseline trade taxonomy, company overrides, and jobsite-specific task instances.

### Rules and permit trigger mapping

- `platform_permit_trigger_rules`
- `company_permit_trigger_rules`
- `company_permits_catalog`
- `company_task_permit_triggers`

These tables keep rule-based permit logic deterministic and auditable before AI is called.

### Hazards, controls, and training

- `company_hazards`
- `company_controls`
- `company_task_hazards`
- `company_task_controls`
- `company_training_matrix_requirements`
- `company_task_training_requirements`

These tables support required controls, hazard families, and training matrix enforcement by trade and task.

### Bucket architecture

- `company_bucket_runs`
- `company_bucket_items`

These are the standardized data buckets that bridge intake from legacy/current flows into rules, conflicts, AI review, and analytics.

### Simultaneous operations and conflict mapping

- `platform_conflict_rules`
- `company_conflict_rules`
- `company_work_areas`
- `company_weather_conditions`
- `company_simultaneous_operations`
- `company_conflict_pairs`

Conflict rules define what should be detected. Conflict pairs store actual detected overlaps and simultaneous-operation findings.

### AI review and document history

- `company_ai_reviews`
- `company_document_templates`
- `company_generated_documents`
- `company_generated_document_versions`

Generated documents keep a mutable current record plus immutable version snapshots for each material change.

### Risk scoring and trend analysis

- `company_risk_scores`
- `company_safety_intelligence_audit_log`
- `company_safety_intelligence_history`

Risk scores support point-in-time and rolling-window analysis. Audit/history tables preserve longitudinal change tracking for analytics and investigations.

## Enums

The migration adds dedicated enums to prevent drift in important workflow states:

- `si_weather_sensitivity`
- `si_task_status`
- `si_control_status`
- `si_bucket_run_status`
- `si_conflict_severity`
- `si_conflict_status`
- `si_ai_review_type`
- `si_ai_review_status`
- `si_document_type`
- `si_document_status`
- `si_risk_band`
- `si_score_scope`

## Relationship highlights

- `platform_sub_trades.trade_id -> platform_trades.id`
- `platform_task_templates.trade_id -> platform_trades.id`
- `platform_task_templates.sub_trade_id -> platform_sub_trades.id`
- `company_trades.platform_trade_id -> platform_trades.id`
- `company_sub_trades.company_trade_id -> company_trades.id`
- `company_sub_trades.platform_sub_trade_id -> platform_sub_trades.id`
- `company_tasks.company_trade_id -> company_trades.id`
- `company_tasks.company_sub_trade_id -> company_sub_trades.id`
- `company_tasks.platform_task_template_id -> platform_task_templates.id`
- `company_work_areas.jobsite_id -> company_jobsites.id`
- `company_bucket_items.bucket_run_id -> company_bucket_runs.id`
- `company_bucket_items.company_task_id -> company_tasks.id`
- `company_simultaneous_operations.bucket_item_id -> company_bucket_items.id`
- `company_conflict_pairs.left_operation_id/right_operation_id -> company_simultaneous_operations.id`
- `company_ai_reviews.bucket_run_id -> company_bucket_runs.id`
- `company_generated_documents.bucket_run_id -> company_bucket_runs.id`
- `company_generated_documents.ai_review_id -> company_ai_reviews.id`
- `company_generated_document_versions.generated_document_id -> company_generated_documents.id`
- `company_risk_scores.bucket_run_id -> company_bucket_runs.id`
- `company_risk_scores.bucket_item_id -> company_bucket_items.id`

## Indexing strategy

The migration includes indexes for the common SaaS query shapes:

- scope and recency indexes on `(company_id, jobsite_id, status, updated_at desc)` for conflicts, reviews, and documents
- time-window indexes on `(company_id, work_area_id, starts_at, ends_at)` for bucket items and simultaneous operations
- lookup indexes for permit trigger rules and conflict rules
- GIN indexes on JSONB columns used by rules, overlaps, and risk outputs
- time-series index on `company_risk_scores(company_id, score_date desc, score_scope, trade_code, task_code)`
- uniqueness on company override natural keys and generated document versions

## Suggested RLS approach

The SQL follows a layered RLS model:

- Platform tables: readable by all authenticated users, writable only by service role or designated platform admin workflows.
- Company operational tables: readable by company members and writable by users who pass `security_can_write_company_data(company_id)`.
- High-sensitivity safety intelligence tables such as generated documents, AI reviews, conflicts, and risk scores: writable only by users who pass `security_can_manage_safety_intelligence(company_id)`.
- Audit/history tables: manager-readable only, and direct inserts/updates/deletes are revoked from authenticated users so changes come from triggers/service workflows instead of manual app writes.

## Audit and history strategy

`si_log_history()` writes to:

- `company_safety_intelligence_history` for before/after state capture
- `company_safety_intelligence_audit_log` for event-centric audit entries

The migration wires history/audit triggers to:

- `company_bucket_runs`
- `company_permit_trigger_rules`
- `company_conflict_rules`
- `company_training_matrix_requirements`
- `company_conflict_pairs`
- `company_ai_reviews`
- `company_generated_documents`
- `company_risk_scores`

## Generated document versioning

- `company_generated_documents` stores the latest canonical record and `current_version`.
- `si_bump_generated_document_version()` increments the version whenever content, storage metadata, status, or provenance materially changes.
- `si_store_generated_document_version()` snapshots every inserted/updated version into `company_generated_document_versions`.
- This supports admin review, rollback/reference, and evidence trails for AI-produced safety documents.

## Seed data

The seed migration loads:

- baseline trades
- baseline task templates
- baseline platform permit trigger rules
- baseline platform conflict rules

This keeps the seeded logic in rule tables instead of polluting runtime findings tables like `company_conflict_pairs`.
