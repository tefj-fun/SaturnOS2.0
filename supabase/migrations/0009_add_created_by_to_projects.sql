alter table if exists public.projects
  add column if not exists created_by uuid references auth.users(id) on delete set null;

alter table if exists public.projects
  alter column created_by set default auth.uid();
