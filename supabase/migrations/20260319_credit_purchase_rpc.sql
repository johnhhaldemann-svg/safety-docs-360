create or replace function public.record_marketplace_purchase(
  p_document_id uuid,
  p_amount integer,
  p_description text,
  p_metadata jsonb default '{}'::jsonb
)
returns public.credit_transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_row public.credit_transactions;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if p_document_id is null then
    raise exception 'Document id is required';
  end if;

  if p_amount >= 0 then
    raise exception 'Marketplace purchases must deduct credits';
  end if;

  insert into public.credit_transactions (
    user_id,
    amount,
    transaction_type,
    document_id,
    description,
    metadata
  )
  values (
    auth.uid(),
    p_amount,
    'purchase',
    p_document_id,
    p_description,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning * into inserted_row;

  return inserted_row;
end;
$$;

revoke all on function public.record_marketplace_purchase(uuid, integer, text, jsonb) from public;
grant execute on function public.record_marketplace_purchase(uuid, integer, text, jsonb) to authenticated;
