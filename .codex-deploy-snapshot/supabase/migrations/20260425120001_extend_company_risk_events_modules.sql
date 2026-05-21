-- Allow new parity modules to emit company_risk_events rows.

alter table public.company_risk_events
  drop constraint if exists company_risk_events_module_check;

alter table public.company_risk_events
  add constraint company_risk_events_module_check check (
    module_name in (
      'permits',
      'incidents',
      'corrective_actions',
      'jsa_activity',
      'sor_record',
      'risk_memory',
      'inductions',
      'toolbox',
      'contractor_prequal',
      'sds',
      'safety_forms',
      'integrations'
    )
  );
