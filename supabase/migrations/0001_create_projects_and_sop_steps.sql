-- Projects table
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  status text not null default 'created',
  sop_file_url text,
  steps_generated boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- SOP steps table
create table if not exists public.sop_steps (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  description text,
  product text,
  condition text,
  classes text[] not null default '{}',
  status text default 'Pass,Fail',
  clarity_score int default 0,
  needs_clarification boolean not null default false,
  is_enabled boolean not null default true,
  is_annotated boolean not null default false,
  step_number int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sop_steps_project_id_idx on public.sop_steps(project_id);

-- Optional: simple updated_at trigger to keep timestamps current
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_projects_updated_at on public.projects;
create trigger trg_projects_updated_at
before update on public.projects
for each row
execute procedure public.set_updated_at();

drop trigger if exists trg_sop_steps_updated_at on public.sop_steps;
create trigger trg_sop_steps_updated_at
before update on public.sop_steps
for each row
execute procedure public.set_updated_at();
