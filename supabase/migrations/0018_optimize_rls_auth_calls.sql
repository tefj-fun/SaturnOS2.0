create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists(
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'admin'
      and p.status = 'active'
  );
$$;

drop policy if exists "profiles select own or admin" on public.profiles;
drop policy if exists "profiles insert own" on public.profiles;
drop policy if exists "profiles update own or admin" on public.profiles;
drop policy if exists "profiles delete admin" on public.profiles;

create policy "profiles select own or admin"
on public.profiles
for select
using (id = (select auth.uid()) or public.is_admin());

create policy "profiles insert own"
on public.profiles
for insert
with check (id = (select auth.uid()));

create policy "profiles update own or admin"
on public.profiles
for update
using (id = (select auth.uid()) or public.is_admin())
with check (id = (select auth.uid()) or public.is_admin());

create policy "profiles delete admin"
on public.profiles
for delete
using (public.is_admin());

drop policy if exists "project_members select project members" on public.project_members;
drop policy if exists "project_members insert owner or admin" on public.project_members;
drop policy if exists "project_members update owner or admin" on public.project_members;
drop policy if exists "project_members delete owner or admin" on public.project_members;

drop policy if exists "project_members select self or admin" on public.project_members;
drop policy if exists "project_members insert self or admin" on public.project_members;
drop policy if exists "project_members update self or admin" on public.project_members;
drop policy if exists "project_members delete self or admin" on public.project_members;

create policy "project_members select self or admin"
on public.project_members
for select
using (
  public.is_admin()
  or user_id = (select auth.uid())
);

create policy "project_members insert self or admin"
on public.project_members
for insert
with check (
  public.is_admin()
  or user_id = (select auth.uid())
);

create policy "project_members update self or admin"
on public.project_members
for update
using (
  public.is_admin()
  or user_id = (select auth.uid())
)
with check (
  public.is_admin()
  or user_id = (select auth.uid())
);

create policy "project_members delete self or admin"
on public.project_members
for delete
using (
  public.is_admin()
  or user_id = (select auth.uid())
);
