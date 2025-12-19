alter table public.sop_steps
  add column if not exists dataset_yaml_path text,
  add column if not exists dataset_yaml_url text,
  add column if not exists dataset_yaml_name text;
