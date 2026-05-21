-- Allow billing audit entries to distinguish payment-link creation from other updates.
alter table public.billing_events drop constraint if exists billing_events_type_check;

alter table public.billing_events
  add constraint billing_events_type_check check (
    event_type in (
      'created',
      'updated',
      'sent',
      'payment_link_created',
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
