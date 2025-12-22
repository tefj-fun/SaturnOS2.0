alter table if exists public.projects enable row level security;
alter table if exists public.sop_steps enable row level security;
alter table if exists public.step_images enable row level security;
alter table if exists public.training_runs enable row level security;
alter table if exists public.trainer_workers enable row level security;
alter table if exists public.build_variants enable row level security;
alter table if exists public.step_variant_configs enable row level security;
alter table if exists public.logic_rules enable row level security;
alter table if exists public.label_library enable row level security;
alter table if exists public.predicted_annotations enable row level security;

drop policy if exists "projects anon all" on public.projects;
create policy "projects anon all"
on public.projects
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "sop_steps anon all" on public.sop_steps;
create policy "sop_steps anon all"
on public.sop_steps
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "step_images anon all" on public.step_images;
create policy "step_images anon all"
on public.step_images
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "training_runs anon all" on public.training_runs;
create policy "training_runs anon all"
on public.training_runs
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "trainer_workers anon all" on public.trainer_workers;
create policy "trainer_workers anon all"
on public.trainer_workers
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "build_variants anon all" on public.build_variants;
create policy "build_variants anon all"
on public.build_variants
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "step_variant_configs anon all" on public.step_variant_configs;
create policy "step_variant_configs anon all"
on public.step_variant_configs
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "logic_rules anon all" on public.logic_rules;
create policy "logic_rules anon all"
on public.logic_rules
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "label_library anon all" on public.label_library;
create policy "label_library anon all"
on public.label_library
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "predicted_annotations anon all" on public.predicted_annotations;
create policy "predicted_annotations anon all"
on public.predicted_annotations
for all
to anon, authenticated
using (true)
with check (true);

alter view if exists public.label_library_view
  set (security_invoker = true);
