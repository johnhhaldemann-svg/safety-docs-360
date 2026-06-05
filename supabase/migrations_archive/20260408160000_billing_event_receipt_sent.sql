-- Allow marketplace receipt emails to be tracked as audit events.
alter table public.billing_events drop constraint if exists billing_events_type_check;

alter table public.billing_events
  add constraint billing_events_type_check check (
    event_type in (
      'created',
      'updated',
      'sent',
      'viewed',
      'reminder_sent',
      'payment_received',
      'marked_paid',
      'receipt_sent',
      'voided',
      'cancelled',
      'payment_failed'
    )
  );
