-- Pin search_path on the shared updated-at trigger function to resolve the Supabase
-- security advisor finding `function_search_path_mutable` (a function with a mutable
-- search_path can be hijacked via a malicious schema on the caller's search_path).
--
-- Behavior is unchanged: search_path is locked to empty and now() is schema-qualified
-- to pg_catalog so the trigger keeps stamping updated_at exactly as before.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;
