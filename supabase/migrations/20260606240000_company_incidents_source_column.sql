ALTER TABLE company_incidents
  ADD COLUMN IF NOT EXISTS source text
    CHECK (source IS NULL OR source IN ('web', 'mobile', 'sms', 'qr_code', 'api', 'import'));

CREATE INDEX IF NOT EXISTS idx_company_incidents_source
  ON company_incidents (company_id, source)
  WHERE source IS NOT NULL;
