create table if not exists public.inference_workers (
  worker_id text primary key,
  status text not null default 'online',
  last_seen timestamptz not null default now(),
  device_type text,
  compute_type text,
  gpu_name text,
  gpu_model text,
  gpu text,
  gpu_memory_gb numeric,
  gpu_vram_gb numeric,
  gpu_memory_mb numeric,
  gpu_vram_mb numeric,
  cpu_model text,
  cpu text,
  ram_gb numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists inference_workers_last_seen_idx on public.inference_workers(last_seen);

drop trigger if exists trg_inference_workers_updated_at on public.inference_workers;
create trigger trg_inference_workers_updated_at
before update on public.inference_workers
for each row
execute procedure public.set_updated_at();

alter table if exists public.inference_workers enable row level security;

drop policy if exists "inference_workers anon all" on public.inference_workers;
create policy "inference_workers anon all"
on public.inference_workers
for all
to anon, authenticated
using (true)
with check (true);
