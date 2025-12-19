create table if not exists public.trainer_workers (
  worker_id text primary key,
  status text not null default 'online',
  last_seen timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists trainer_workers_last_seen_idx on public.trainer_workers(last_seen);

drop trigger if exists trg_trainer_workers_updated_at on public.trainer_workers;
create trigger trg_trainer_workers_updated_at
before update on public.trainer_workers
for each row
execute procedure public.set_updated_at();
