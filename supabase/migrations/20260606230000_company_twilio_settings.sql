-- Company Twilio settings (one row per company)
CREATE TABLE IF NOT EXISTS company_twilio_settings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  phone_number    text NOT NULL,          -- E.164 format e.g. +15551234567
  account_sid     text NOT NULL,
  auth_token      text NOT NULL,          -- stored as-is; encrypt in hardening pass
  enabled         boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id),
  UNIQUE (phone_number)
);

CREATE INDEX IF NOT EXISTS idx_company_twilio_settings_company
  ON company_twilio_settings (company_id);

ALTER TABLE company_twilio_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_twilio_settings_read" ON company_twilio_settings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM company_memberships cm
      WHERE cm.company_id = company_twilio_settings.company_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('company_admin', 'safety_manager')
        AND cm.status = 'active'
    )
  );

CREATE POLICY "company_twilio_settings_write" ON company_twilio_settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM company_memberships cm
      WHERE cm.company_id = company_twilio_settings.company_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'company_admin'
        AND cm.status = 'active'
    )
  );

-- Track SMS origin on incidents
ALTER TABLE company_incidents
  ADD COLUMN IF NOT EXISTS sms_from_number text,
  ADD COLUMN IF NOT EXISTS sms_body        text;
