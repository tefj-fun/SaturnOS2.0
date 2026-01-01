create table if not exists public.billing_settings (
  key text primary key default 'default',
  monthly_spend_cap numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_billing_settings_updated_at on public.billing_settings;
create trigger trg_billing_settings_updated_at
before update on public.billing_settings
for each row
execute procedure public.set_updated_at();

alter table if exists public.billing_settings enable row level security;

drop policy if exists "billing_settings select authenticated" on public.billing_settings;
create policy "billing_settings select authenticated"
on public.billing_settings
for select
to authenticated
using (true);

drop policy if exists "billing_settings modify admin" on public.billing_settings;
create policy "billing_settings modify admin"
on public.billing_settings
for all
using (public.is_admin())
with check (public.is_admin());
