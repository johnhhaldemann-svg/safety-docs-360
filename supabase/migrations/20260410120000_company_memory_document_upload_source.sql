-- Allow memory rows sourced from uploaded PDF/DOCX (text extracted server-side).

alter table public.company_memory_items
  drop constraint if exists company_memory_items_source_check;

alter table public.company_memory_items
  add constraint company_memory_items_source_check
  check (
    source in (
      'manual',
      'document_excerpt',
      'incident_summary',
      'other',
      'document_upload'
    )
  );
