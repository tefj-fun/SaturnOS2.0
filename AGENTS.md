# AGENTS.md

## Purpose
Provide quick, repo-specific guidance for coding agents working on SaturnOS 2.0.

## Stack
- React + Vite + Tailwind CSS frontend.
- Supabase (auth, Postgres, storage).
- Netlify functions for serverless helpers.
- Optional Python trainer worker in `.trainer-tmp`.

## Layout
- `src/pages/` route-level views.
- `src/components/` shared UI.
- `src/api/`, `src/lib/`, `src/contexts/`, `src/hooks/`, `src/utils/` supporting code.
- `netlify/functions/` serverless helpers.
- `supabase/migrations/` database schema + RLS.

## Conventions
- Use function components and hooks; keep components small and composable.
- Prefer Tailwind utility classes over custom CSS; keep `App.css`/`index.css` minimal.
- Keep Supabase access in `src/api` or `src/lib` helpers; avoid inline data access in pages.
- Avoid editing `dist/` (generated output).
- Do not commit secrets; use `.env.local` for local config.

## Commands
- `npm run dev` for local dev.
- `npm run lint` before shipping.
- `npm run test:run` for a single Vitest run.

## Notes
- When changing storage or permissions, update Supabase migrations and RLS policies.
- Netlify functions are used for OpenAI proxy and invites; keep API surface minimal and validated.
