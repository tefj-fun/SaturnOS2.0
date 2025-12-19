alter table public.training_runs
  add column if not exists cancel_requested boolean not null default false,
  add column if not exists canceled_at timestamptz;

create index if not exists training_runs_cancel_requested_idx on public.training_runs(cancel_requested);
