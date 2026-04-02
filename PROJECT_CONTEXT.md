# SmartHop — Shared Agent Context (PROJECT_CONTEXT.md)

## Stack
- Frontend: Next.js 15 App Router + TypeScript + Tailwind v4 + shadcn/ui
- Backend: Supabase (PostgreSQL + RLS + Realtime + Auth)
- ML Service: FastAPI (Python 3.10, scikit-learn 1.4.2)
- Maps: Leaflet / React-Leaflet with OSM tiles (NO Google Maps)
- Deploy: Vercel (Next.js) + Render free tier (FastAPI)

## Critical Rules
- Tailwind v4: NO tailwind.config.ts — all config in globals.css via @theme
- All Leaflet map components: dynamic import with { ssr: false } (mandatory)
- Supabase client: use @supabase/ssr createBrowserClient in "use client" files
- All errors: Sonner toast — never show raw Error.message to user
- TypeScript: run npx tsc --noEmit after every batch of files

## Existing ML Models (do NOT retrain — just load from .joblib)
cluster_scaler.joblib, dbscan_model.joblib, kmeans_model.joblib
fare_lr_model.joblib, fare_rf_model.joblib, fare_shared_rf_model.joblib
fare_scaler.joblib, driver_ranking_model.joblib, ranking_scaler.joblib

## Navigation Architecture
- /rider/* pages: SharedTopBar (sticky top) + MobileNav (fixed bottom, 4 tabs)
- /driver/* pages: SharedTopBar driver variant + DriverNav (fixed bottom, 3 tabs)
- /admin/* pages: AdminSidebar (desktop) + AdminTabBar (mobile top)
- Sub-pages (ticket, tracking, fare-summary, route): BackArrowHeader
- Public / : TopNav with Login + Sign Up links
- /auth/* and /onboarding: no navigation component

## Agent Prefix (paste before every step prompt)
You are building SmartHop — a Mumbai Metro last-mile shared ride platform.
Read PROJECT_CONTEXT.md at the project root before writing any code.
Follow the navigation architecture defined in PROJECT_CONTEXT.md exactly.
Also implement the navigation additions specified for this step number.
After generating files: run npx tsc --noEmit — zero errors required.
