create table if not exists public.step_images (
  id uuid primary key default gen_random_uuid(),
  step_id uuid not null references public.sop_steps(id) on delete cascade,
  image_url text not null,
  thumbnail_url text,
  display_url text,
  image_name text,
  file_size bigint,
  image_group text default 'Untagged',
  processing_status text default 'completed',
  annotations jsonb default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists step_images_step_id_idx on public.step_images(step_id);
create index if not exists step_images_image_group_idx on public.step_images(image_group);

drop trigger if exists trg_step_images_updated_at on public.step_images;
create trigger trg_step_images_updated_at
before update on public.step_images
for each row
execute procedure public.set_updated_at();
