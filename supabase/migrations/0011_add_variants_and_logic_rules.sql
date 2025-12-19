create table if not exists public.build_variants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  attributes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists build_variants_name_idx on public.build_variants(name);

drop trigger if exists trg_build_variants_updated_at on public.build_variants;
create trigger trg_build_variants_updated_at
before update on public.build_variants
for each row
execute procedure public.set_updated_at();

create table if not exists public.step_variant_configs (
  id uuid primary key default gen_random_uuid(),
  build_variant_id uuid not null references public.build_variants(id) on delete cascade,
  sop_step_id uuid not null references public.sop_steps(id) on delete cascade,
  active_classes text[] not null default '{}'::text[],
  status_options text,
  active_logic_rule_ids uuid[] not null default '{}'::uuid[],
  inference_model_id uuid references public.training_runs(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (build_variant_id, sop_step_id)
);

create index if not exists step_variant_configs_variant_id_idx on public.step_variant_configs(build_variant_id);
create index if not exists step_variant_configs_step_id_idx on public.step_variant_configs(sop_step_id);

drop trigger if exists trg_step_variant_configs_updated_at on public.step_variant_configs;
create trigger trg_step_variant_configs_updated_at
before update on public.step_variant_configs
for each row
execute procedure public.set_updated_at();

create table if not exists public.logic_rules (
  id uuid primary key default gen_random_uuid(),
  step_id uuid not null references public.sop_steps(id) on delete cascade,
  rule_name text not null,
  is_active boolean not null default true,
  rule_type text not null default 'quantity',
  condition text,
  operator text,
  value text,
  subject_class text,
  relationship text,
  target_class text,
  coverage int,
  iou_operator text,
  iou_value numeric,
  priority int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists logic_rules_step_id_idx on public.logic_rules(step_id);

drop trigger if exists trg_logic_rules_updated_at on public.logic_rules;
create trigger trg_logic_rules_updated_at
before update on public.logic_rules
for each row
execute procedure public.set_updated_at();

create table if not exists public.label_library (
  id uuid primary key default gen_random_uuid(),
  label_name text not null,
  projects_used text[] not null default '{}'::text[],
  total_annotations int not null default 0,
  sample_images text[] not null default '{}'::text[],
  average_confidence numeric not null default 0,
  category text,
  color_hex text,
  description text,
  last_used timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists label_library_name_idx on public.label_library(label_name);

drop trigger if exists trg_label_library_updated_at on public.label_library;
create trigger trg_label_library_updated_at
before update on public.label_library
for each row
execute procedure public.set_updated_at();

create table if not exists public.predicted_annotations (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.training_runs(id) on delete set null,
  step_image_id uuid references public.step_images(id) on delete set null,
  annotations jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists predicted_annotations_run_id_idx on public.predicted_annotations(run_id);
create index if not exists predicted_annotations_step_image_id_idx on public.predicted_annotations(step_image_id);

drop trigger if exists trg_predicted_annotations_updated_at on public.predicted_annotations;
create trigger trg_predicted_annotations_updated_at
before update on public.predicted_annotations
for each row
execute procedure public.set_updated_at();
