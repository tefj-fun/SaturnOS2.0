create index if not exists projects_created_by_idx
  on public.projects(created_by);

create index if not exists step_variant_configs_inference_model_id_idx
  on public.step_variant_configs(inference_model_id);
