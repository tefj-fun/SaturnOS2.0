alter table if exists public.sop_steps
add column if not exists clarification_questions text[] not null default '{}';
