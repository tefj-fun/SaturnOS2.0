create or replace view public.label_library_view as
with normalized_images as (
  select
    si.id as step_image_id,
    si.step_id,
    si.image_url,
    coalesce(si.updated_at, si.created_at) as image_ts,
    case
      when jsonb_typeof(si.annotations) = 'array' then si.annotations
      when jsonb_typeof(si.annotations) = 'object' then coalesce(si.annotations->'annotations', '[]'::jsonb)
      else '[]'::jsonb
    end as annotations
  from public.step_images si
),
annotation_rows as (
  select
    ni.step_image_id,
    ni.step_id,
    ni.image_url,
    ni.image_ts,
    ann.value as ann
  from normalized_images ni
  cross join lateral jsonb_array_elements(ni.annotations) ann(value)
),
normalized as (
  select
    ar.step_image_id,
    ar.step_id,
    ar.image_url,
    ar.image_ts,
    nullif(btrim(coalesce(
      ar.ann->>'class',
      ar.ann->>'label',
      ar.ann->>'class_name',
      ar.ann->>'name'
    )), '') as label_name,
    nullif(ar.ann->>'confidence', '')::numeric as confidence
  from annotation_rows ar
),
filtered as (
  select *
  from normalized
  where label_name is not null
),
stats as (
  select
    f.label_name,
    count(*)::int as total_annotations,
    array_agg(distinct s.project_id::text) as projects_used,
    array_agg(distinct f.image_url) filter (where f.image_url is not null) as sample_images,
    avg(f.confidence) filter (where f.confidence is not null) as average_confidence,
    max(f.image_ts) as last_used,
    min(f.image_ts) as first_seen
  from filtered f
  join public.sop_steps s on s.id = f.step_id
  group by f.label_name
),
merged as (
  select
    coalesce(m.label_name, s.label_name) as label_name,
    m.id as meta_id,
    m.projects_used as meta_projects_used,
    m.sample_images as meta_sample_images,
    m.average_confidence as meta_average_confidence,
    m.category as meta_category,
    m.color_hex as meta_color_hex,
    m.description as meta_description,
    m.last_used as meta_last_used,
    m.created_at as meta_created_at,
    m.updated_at as meta_updated_at,
    s.total_annotations,
    s.projects_used,
    s.sample_images,
    s.average_confidence,
    s.last_used,
    s.first_seen
  from stats s
  full join public.label_library m on m.label_name = s.label_name
)
select
  coalesce(meta_id, (
    substr(md5(label_name), 1, 8) || '-' ||
    substr(md5(label_name), 9, 4) || '-' ||
    substr(md5(label_name), 13, 4) || '-' ||
    substr(md5(label_name), 17, 4) || '-' ||
    substr(md5(label_name), 21, 12)
  )::uuid) as id,
  label_name,
  coalesce(projects_used, meta_projects_used, '{}'::text[]) as projects_used,
  coalesce(total_annotations, 0) as total_annotations,
  coalesce(sample_images, meta_sample_images, '{}'::text[]) as sample_images,
  coalesce(average_confidence, meta_average_confidence, 0) as average_confidence,
  coalesce(meta_category, 'Other') as category,
  coalesce(meta_color_hex, '#64748B') as color_hex,
  coalesce(meta_description, '') as description,
  coalesce(last_used, meta_last_used, meta_updated_at, meta_created_at, now()) as last_used,
  coalesce(meta_created_at, first_seen, now()) as created_at,
  coalesce(meta_updated_at, last_used, now()) as updated_at
from merged
where label_name is not null;
