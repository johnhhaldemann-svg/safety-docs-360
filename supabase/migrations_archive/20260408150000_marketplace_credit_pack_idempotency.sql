begin;

create unique index if not exists billing_invoice_payments_external_payment_id_unique
on public.billing_invoice_payments (external_payment_id)
where external_payment_id is not null;

create unique index if not exists company_credit_transactions_marketplace_credit_pack_unique
on public.company_credit_transactions (
  company_id,
  (metadata ->> 'invoice_id')
)
where transaction_type = 'grant'
  and metadata ->> 'source' = 'marketplace_credit_pack'
  and metadata ->> 'invoice_id' is not null;

commit;
