alter table public.training_runs
  add column if not exists step_id uuid references public.sop_steps(id) on delete set null,
  add column if not exists base_model text,
  add column if not exists configuration jsonb,
  add column if not exists data_yaml text,
  add column if not exists trained_model_url text,
  add column if not exists created_by text,
  add column if not exists is_deployed boolean not null default false,
  add column if not exists deployment_status text,
  add column if not exists deployment_date timestamptz,
  add column if not exists deployment_url text,
  add column if not exists started_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists worker_id text,
  add column if not exists error_message text;

create index if not exists training_runs_step_id_idx on public.training_runs(step_id);
create index if not exists training_runs_status_idx on public.training_runs(status);
