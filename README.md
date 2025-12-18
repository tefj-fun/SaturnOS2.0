# SaturnOS 2.0

Annotation studio for SOP-driven visual QA workflows.

## What it does
- Create projects and upload SOP PDFs.
- Generate steps and classes from SOPs (LLM-assisted).
- Annotate step images with autosave, undo/redo, and grouping.
- Review images and insights in dedicated tabs.

## Tech stack
- React + Vite
- Tailwind CSS
- Supabase (Postgres + Storage)
- OpenAI (LLM helpers)

## Local setup
1. Install dependencies:

```bash
npm install
```

2. Create `.env.local`:

```bash
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_OPENAI_API_KEY=your_openai_api_key
```

Note: `VITE_OPENAI_API_KEY` is used in the browser. For production, consider proxying via a backend.

3. Apply database migrations:
   - Use Supabase SQL editor to run the files in `supabase/migrations/`, or
   - Use the Supabase CLI and run `supabase db push`.

4. Create storage buckets (private):
   - `sops`
   - `step-images`

5. Run the app:

```bash
npm run dev
```

## Build

```bash
npm run build
```

## Notes
- Annotation state is stored in `step_images.annotations` (JSONB).
- The annotation studio keeps `projectId`, `stepId`, and `imageId` in the URL so refresh restores context.
