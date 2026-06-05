alter table public.owner_customer_ready_gates
  add column if not exists customer_ready_status text not null default 'Not tested',
  add column if not exists super_admin_approved boolean not null default false,
  add column if not exists approved_by uuid null references auth.users (id) on delete set null,
  add column if not exists approved_at timestamptz null,
  add column if not exists latest_owner_proof_report_id uuid null references public.owner_validation_runs (id) on delete set null;

alter table public.owner_customer_ready_gates
  drop constraint if exists owner_customer_ready_gates_customer_ready_status_check;

alter table public.owner_customer_ready_gates
  add constraint owner_customer_ready_gates_customer_ready_status_check check (
    customer_ready_status in (
      'Not tested',
      'Blocked',
      'Needs owner review',
      'Approved for demo',
      'Approved for customer use'
    )
  );

alter table public.owner_customer_ready_gates
  drop constraint if exists owner_customer_ready_gates_ready_check;

alter table public.owner_customer_ready_gates
  add constraint owner_customer_ready_gates_ready_check check (
    customer_ready = false
    or (
      customer_ready_status = 'Approved for customer use'
      and automated_validation_status in ('green', 'yellow')
      and owner_visual_review_status = 'passed'
      and super_admin_approved = true
      and approved_by is not null
      and approved_at is not null
      and latest_owner_proof_report_id is not null
      and blocking_reason is null
    )
  );

create index if not exists owner_customer_ready_gates_status_idx
  on public.owner_customer_ready_gates (customer_ready_status);
