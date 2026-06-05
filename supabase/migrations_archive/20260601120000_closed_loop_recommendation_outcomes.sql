-- Closed-loop AI recommendation outcomes.
-- Allows the existing recommendation event audit table to store outcome and learning events
-- created when a linked corrective action is verified closed.

alter table public.company_risk_recommendation_events
  drop constraint if exists company_risk_recommendation_events_event_type_check;

alter table public.company_risk_recommendation_events
  add constraint company_risk_recommendation_events_event_type_check check (
    event_type in (
      'created',
      'accepted',
      'assigned',
      'field_used',
      'resolved',
      'dismissed',
      'feedback',
      'documentation_requested',
      'inspection_requested',
      'corrective_action_created',
      'permit_requested',
      'accountability_review_requested',
      'stop_work_review_requested',
      'outcome_recorded',
      'learning_event_created'
    )
  );

comment on constraint company_risk_recommendation_events_event_type_check
  on public.company_risk_recommendation_events is
  'Includes closed-loop outcome and learning events for AI recommendations linked to corrective actions.';
