-- Allow any company member (not only managers) to read subscription + ledger rows for their
-- company. Manager-only policies remain for mutations. Fixes empty reads for roles like
-- superintendent when the API uses the user JWT instead of service role.

drop policy if exists company_subscriptions_select_member_scope on public.company_subscriptions;
create policy company_subscriptions_select_member_scope
  on public.company_subscriptions
  for select
  to authenticated
  using (public.security_is_company_member(company_id));

drop policy if exists company_credit_transactions_select_member_scope on public.company_credit_transactions;
create policy company_credit_transactions_select_member_scope
  on public.company_credit_transactions
  for select
  to authenticated
  using (public.security_is_company_member(company_id));
