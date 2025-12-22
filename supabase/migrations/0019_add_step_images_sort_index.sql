create index if not exists step_images_step_id_created_at_idx
  on public.step_images(step_id, created_at desc);
