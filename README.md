# SaturnOS 2.0 (Base44 App)

Guided LLM annotation workspace built with Vite + React and powered by the Base44 SDK. It covers the full lifecycle from project setup to annotation, QA, training, build variants, results, and settings.

## Features
- Projects & Setup: create projects, upload SOPs, auto-generate steps with the Base44 LLM, and track setup progress.
- Annotation Studio: canvas with drawing/labels, AI copilot chat, logic builder, step navigation, and image portal.
- Review & QA: review predicted annotations, approve/reject, and capture feedback.
- Training & Build Variants: configure training runs, monitor status/history, and manage build variants with per-step configs.
- Label Library & Results: maintain label sets and explore dashboards/results/analysis.
- Settings & RBAC: workspace settings, member permissions, and user info surfaced in the UI.

## Tech Stack
- React 18 + Vite 6 + React Router
- TailwindCSS with shadcn/radix UI components, lucide-react icons, framer-motion, recharts
- Base44 SDK (`@base44/sdk`) for data, auth, and integrations (appId `6899651adcb30c1ab571dd01`)

## Prerequisites
- Node.js 18+ and npm
- Base44 account/workspace access (SDK is configured with `requiresAuth: true`)

## Getting Started
```bash
npm install
npm run dev
```
Open http://localhost:5173.

## Build & Preview
- `npm run build` – production build to `dist/`
- `npm run preview` – serve the production build locally

## Lint
```bash
npm run lint
```

## Key Paths
- `src/pages/` – routed screens (Projects, ProjectSetup, AnnotationStudio, AnnotationReview, Training*, BuildVariants, LabelLibrary, Results*, Dashboard, Settings)
- `src/components/` – UI primitives and feature components (annotation tools, project dialogs, training, build variants, RBAC)
- `src/api/` – Base44 client, entities, and integrations
- `src/utils/index.ts` – URL helper for page routing

For support, contact Base44 at app@base44.com.
