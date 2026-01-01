update public.profiles
set preferences = jsonb_set(
  jsonb_set(
    jsonb_set(coalesce(preferences, '{}'::jsonb),
      '{onboarding,enabled}', 'true'::jsonb, true),
    '{onboarding,completed}', 'false'::jsonb, true),
  '{onboarding,prompt_disabled}', 'false'::jsonb, true
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, email, full_name, preferences)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    jsonb_build_object(
      'onboarding', jsonb_build_object(
        'enabled', true,
        'completed', false,
        'prompt_disabled', false
      )
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
