begin;

alter table public.company_mobile_feature_entitlements
drop constraint if exists company_mobile_feature_entitlements_feature_check;

alter table public.company_mobile_feature_entitlements
add constraint company_mobile_feature_entitlements_feature_check check (
  feature in (
    'mobile_dashboard',
    'mobile_jobsites',
    'mobile_jsa',
    'mobile_field_issues',
    'mobile_field_audits',
    'mobile_permits',
    'mobile_incidents',
    'mobile_toolbox',
    'mobile_training',
    'mobile_documents',
    'mobile_safety_intelligence',
    'mobile_reports',
    'mobile_photos',
    'mobile_signatures'
  )
);

commit;
