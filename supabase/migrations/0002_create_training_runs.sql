create table if not exists public.training_runs (
  id uuid primary key default gen_random_uuid(),
  run_name text not null,
  project_id uuid references public.projects(id) on delete set null,
  status text not null default 'queued',
  results jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists training_runs_project_id_idx on public.training_runs(project_id);

drop trigger if exists trg_training_runs_updated_at on public.training_runs;
create trigger trg_training_runs_updated_at
before update on public.training_runs
for each row
execute procedure public.set_updated_at();
