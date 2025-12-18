drop policy if exists "project_members select project members" on public.project_members;
drop policy if exists "project_members insert owner or admin" on public.project_members;
drop policy if exists "project_members update owner or admin" on public.project_members;
drop policy if exists "project_members delete owner or admin" on public.project_members;

create policy "project_members select self or admin"
on public.project_members
for select
using (
  public.is_admin()
  or user_id = auth.uid()
);

create policy "project_members insert self or admin"
on public.project_members
for insert
with check (
  public.is_admin()
  or user_id = auth.uid()
);

create policy "project_members update self or admin"
on public.project_members
for update
using (
  public.is_admin()
  or user_id = auth.uid()
)
with check (
  public.is_admin()
  or user_id = auth.uid()
);

create policy "project_members delete self or admin"
on public.project_members
for delete
using (
  public.is_admin()
  or user_id = auth.uid()
);
