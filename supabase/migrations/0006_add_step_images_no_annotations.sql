alter table public.step_images
  add column if not exists no_annotations_needed boolean not null default false;
