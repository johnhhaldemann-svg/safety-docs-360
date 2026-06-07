-- Migration: Add reminder_milestones_sent to ca_rca_capa_items
-- Tracks which due-date reminder thresholds (7d, 3d, due, overdue) have been
-- fired for each CAPA item so the daily cron never double-sends.

ALTER TABLE ca_rca_capa_items
  ADD COLUMN IF NOT EXISTS reminder_milestones_sent jsonb NOT NULL DEFAULT '{}';

COMMENT ON COLUMN ca_rca_capa_items.reminder_milestones_sent IS
  'Records which reminder thresholds have been sent. Keys: "7d", "3d", "due", "overdue". Values: ISO timestamp of when that reminder was sent.';

-- Index to efficiently find CAPA items eligible for reminders
CREATE INDEX IF NOT EXISTS idx_ca_rca_capa_items_due_reminder
  ON ca_rca_capa_items (due_at, status)
  WHERE due_at IS NOT NULL AND status IN ('open', 'in_progress');
