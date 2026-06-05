alter table public.user_profiles
add column if not exists gus_notification_settings jsonb not null default
  '{
    "autoOpenEnabled": true,
    "inAppEnabled": true,
    "emailEnabled": true,
    "voiceEnabled": false,
    "textOnlyMode": false
  }'::jsonb;

comment on column public.user_profiles.gus_notification_settings is
  'Per-user Gus notification and voice preferences. Critical safety escalations may still surface in-app for human review.';
