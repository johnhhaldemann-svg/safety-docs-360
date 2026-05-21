create unique index if not exists company_signup_requests_pending_email_idx
  on public.company_signup_requests (lower(primary_contact_email))
  where status = 'pending';
