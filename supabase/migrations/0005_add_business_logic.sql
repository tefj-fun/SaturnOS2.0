alter table if exists public.sop_steps
  add column if not exists business_logic text;
