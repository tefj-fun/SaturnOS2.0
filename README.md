# SaturnOS 2.0

Annotation studio for SOP-driven visual QA workflows.

## Overview
SaturnOS 2.0 helps QA teams turn SOPs into structured steps, upload datasets and images, annotate consistently, and track model training and results. It is a Vite + React frontend backed by Supabase for auth, Postgres, and storage, with Netlify functions for server-side helpers.

## Key workflows
- Projects: create projects, upload SOP PDFs, and store status metadata.
- Step generation: extract steps, classes, and logic from SOPs with the LLM helper.
- Step management: refine steps, classes, and dataset YAML metadata.
- Annotation studio: upload step images or datasets, annotate with autosave, and review work.
- Training: configure training runs, monitor status, and view model metadata.
- Results: inspect insights, label library analytics, and reporting views.
- Admin: manage members, roles, and feature visibility.

## Architecture
- Frontend: React + Vite + Tailwind CSS.
- Backend: Supabase (auth, Postgres, storage).
- Serverless: Netlify functions for OpenAI proxy and user invites.
- Optional: Python trainer worker for YOLOv8 runs in `.trainer-tmp`.

## Repo layout
- `src/` - React app (pages, components, API clients).
- `supabase/migrations/` - SQL schema and RLS policies.
- `netlify/functions/` - OpenAI proxy and invite-user helpers.
- `.trainer-tmp/` - Optional training worker service.
- `dist/` - Production build output.

## Storage buckets
Create the following Supabase Storage buckets:
- `sops` - SOP PDFs.
- `step-images` - Annotated images.
- `datasets` - Training datasets and exports.
- `training-artifacts` - Optional YOLO artifacts (trainer service).

The UI creates signed URLs for private buckets; keep `step-images` and `datasets` private. `sops` can be private as well since the app attempts signed URLs when needed.

## Environment variables
Frontend (Vite):
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_OPENAI_PROXY_URL=http://localhost:8888/.netlify/functions/openai
VITE_INVITE_USER_URL=http://localhost:8888/.netlify/functions/invite-user
VITE_STEP_IMAGES_BUCKET=step-images
VITE_DATASET_BUCKET=datasets
VITE_SUPABASE_REQUIRE_AUTH=false
```

Netlify functions:
```
OPENAI_API_KEY=...
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Trainer worker (`.trainer-tmp/trainer_service.py`):
```
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_STORAGE_BUCKET=sops
SUPABASE_DATASETS_BUCKET=datasets
SUPABASE_ARTIFACTS_BUCKET=training-artifacts
DATASET_ROOT=/mnt/d/datasets
RUNS_DIR=/mnt/d/datasets/runs
POLL_INTERVAL=10
HEARTBEAT_INTERVAL=10
PROGRESS_INTERVAL=10
CANCEL_CHECK_INTERVAL=5
WORKER_ID=trainer-01
TIMESTAMP_STREAMS=1
```

## Local setup
1. Install dependencies:
```
npm install
```

2. Create `.env.local` using the frontend variables above.

3. Apply database migrations:
- Supabase SQL editor: run files in `supabase/migrations/` in order.
- Supabase CLI: `supabase db push`.

4. Create the storage buckets listed above.

5. Run the app:
```
npm run dev
```

6. If you need the Netlify functions locally, use `netlify dev` and set the function env vars in your shell.

## Database schema (high level)
- `projects` - Projects, SOP metadata, and status.
- `sop_steps` - Step definitions, classes, logic, dataset YAML links.
- `step_images` - Uploaded images and annotations JSONB.
- `training_runs` - Training configuration, progress, and artifacts.
- `profiles` - User profile, role, and preferences.
- `project_members` - Per-project role membership and permissions.
- `build_variants` and `step_variant_configs` - Variant definitions and per-step settings.
- `logic_rules` - Per-step logic and validation rules.
- `label_library` - Label metadata and curation.
- `predicted_annotations` - Model outputs per step image.
- `trainer_workers` - Training worker heartbeats.
- `label_library_view` - Aggregated label analytics view.

RLS is enabled on `profiles` and `project_members` with the `is_admin()` helper and a trigger to seed profiles on sign-up.

## Serverless helpers
- `netlify/functions/openai.js` proxies chat completions (default model `gpt-4o-mini`) and supports JSON response mode.
- `netlify/functions/invite-user.js` creates Supabase invites using a service role key, restricted to admins or project owners.

## Scripts
- `npm run dev` - Vite dev server.
- `npm run build` - Production build.
- `npm run preview` - Preview build output.
- `npm run lint` - ESLint.

## Notes
- Annotation state is stored in `step_images.annotations` (JSONB).
- Annotation Studio persists `projectId`, `stepId`, and `imageId` in query params for refreshable context.
- Feature visibility is controlled via `profiles.preferences.features`, merged with defaults in `src/pages/Layout.jsx` (admins see all items).
