-- Migration: Add OSHA 300 log fields to company_incidents
-- osha_description  — AI-drafted or manually entered Column F text
-- osha_case_number  — sequential case number for the OSHA 300 log (per company per year)
-- osha_employee_name / osha_job_title — allow overriding display name for the log
--   without touching the incident reporter link
-- osha_autofilled_at — timestamp of last AI auto-fill so the UI can show staleness

ALTER TABLE company_incidents
  ADD COLUMN IF NOT EXISTS osha_description    text,
  ADD COLUMN IF NOT EXISTS osha_case_number    text,
  ADD COLUMN IF NOT EXISTS osha_employee_name  text,
  ADD COLUMN IF NOT EXISTS osha_job_title      text,
  ADD COLUMN IF NOT EXISTS osha_autofilled_at  timestamptz;

COMMENT ON COLUMN company_incidents.osha_description IS
  'OSHA 300 Column F — description of injury/illness, body part, and object/substance. AI-drafted or manually entered.';
COMMENT ON COLUMN company_incidents.osha_case_number IS
  'OSHA 300 Column A — company-assigned case number for the log year.';
COMMENT ON COLUMN company_incidents.osha_autofilled_at IS
  'Timestamp of last AI OSHA auto-fill run on this incident.';

-- Index to support the annual OSHA 300 log query efficiently
CREATE INDEX IF NOT EXISTS idx_company_incidents_osha_log
  ON company_incidents (company_id, occurred_at, recordable)
  WHERE recordable = true;
