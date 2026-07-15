# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Idioma

Sempre responder ao usuário em português do Brasil (pt-BR), incluindo mensagens, explicações e comentários voltados ao usuário. Código e nomes técnicos permanecem como estão no projeto.

## Project

SDA-V8 — "Sistema de Cotação Serra Dourada": a car-rental counter quotation tool (Portuguese/pt-BR UI). Two roles: VENDEDOR (salesperson, builds quotes) and SUPERVISOR (configures pricing rules, taxes, users). Originated as a Google AI Studio app (see `metadata.json`, `README.md`).

## Commands

- `npm run dev` — start dev server (`tsx server.ts`), Express + Vite middleware mode, on port 3000 (or `$PORT`)
- `npm run build` — `vite build` (client) + `esbuild` bundles `server.ts` to `dist/server.cjs`
- `npm run start` — run the production build (`node dist/server.cjs`)
- `npm run lint` — `tsc --noEmit` (no separate test runner or ESLint config present)

There is no automated test suite. `test.js` is a scratch script (uses `date-fns`), not a real test — run it directly with `node test.js` if needed.

## Architecture

**Important: the codebase is mid-migration between two different auth/data systems — expect inconsistency.**

1. **Legacy system (currently what actually runs the app):** `server.ts` is an Express server that serves as both the API backend and Vite dev-server host. It persists all data in a flat-file JSON "database" (`db.json`, gitignored, auto-created from `defaultDb` on first run) — there is no real database here despite `db.json`'s name. Auth is custom JWT-in-httpOnly-cookie (`JWT_SECRET`, default fallback in source — expect this in `db.json`'s `users` array with plaintext passwords). `src/App.tsx` still calls `/api/auth/me` and `/api/auth/logout` against this Express server.
2. **New system (in progress, not yet fully wired up):** `src/pages/Login.tsx` and `src/lib/supabase.ts` authenticate directly against Supabase (`@supabase/supabase-js`, client-side, using `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` from `.env.local`), reading a `perfis` table for role info. This bypasses `server.ts` entirely on login, but the rest of the app (`App.tsx`'s session check, `Vendedor.tsx`/`Supervisor.tsx` data fetching) still talks to the old Express/JSON API. When touching auth or user data, check which system a given file actually uses before assuming consistency — don't assume Supabase is fully wired in just because `Login.tsx` uses it.

**Server (`server.ts`):**
- Most collections now persist in **Supabase** via a `createSupabaseCrud(path, table)` factory (`categories`, `taxes`, `rules`, `franchises`, `interest-rates` → table `interest_rates`, `third-parties` → `third_parties`, `settings`; plus `vantagens` with hand-written handlers). Writes require the `SUPERVISOR` role (`supervisorMiddleware`), reads just require a valid JWT (`authMiddleware`). `proposals` also lives in Supabase but has **hand-written handlers** (not the factory) because its POST must be allowed for `VENDEDOR` — supervisor sees all, vendedor sees only their own (`user_id`); DELETE is supervisor-only. **User management** (`GET/POST/PUT/DELETE /api/users`, supervisor-only) now operates on the **real Supabase Auth users + `perfis` table** (`id` uuid, `nome`, `role`) via the service-role Admin API (`supabaseAdmin.auth.admin.*`) — no longer the db.json `users` array. Passwords are write-only (Auth stores them hashed; never returned). The legacy `POST /api/auth/login` (plaintext-password check against db.json) was **removed** (it was a Supabase-Auth bypass with default creds). The generic `createCrud(...)`/`db.json` path is now effectively unused for real data (only harmless leftover `defaultDb` arrays remain).
- `GET /api/system-params` is the single aggregate endpoint the quotation UI (`Vendedor.tsx`) loads on mount — it bundles active categories/taxes plus franchises, interest rates, third-party rules, rules, and settings.
- In dev, Vite runs in middleware mode inside the same Express process (`server: { middlewareMode: true }`); in production, Express serves the built `dist/` static assets with an SPA catch-all.

**Client (`src/`):**
- Routing (`App.tsx`, react-router-dom v7): `/login`, `/vendedor`, `/supervisor` (SUPERVISOR-only), `/` redirects based on session role. Session state is a single `user` object held in `App.tsx` and passed down as a prop — there's no global store/context.
- `pages/Vendedor.tsx` is the core business-logic screen — a single large component containing all quote-calculation logic (no extraction into hooks/utils):
  - **Diária (day-rate) calculation**: computes elapsed hours between retirada (pickup) and devolução (return) datetimes, derives `diarias` (whole days) + `horasExtras` (remainder hours), then buckets the remainder into a tolerance/half-day/full-extra-day surcharge (`taxaHorasExtras`: 0, 0.5, or 1) — 1-3h tolerated free, 4-6h is a half diária, 7h+ is a full diária.
  - **Pricing** (`calcularProposta`): combines base diária (padrão vs. piso rate depending on `ativarAlcada` — "alçada"/floor-price override), franchise cost by combo (NORMAL/REDUZIDA/ZERO) and alçada tier, third-party protection daily rate (by day-count band, skippable via `ativarTerceiro`), applicable taxes (fixed/daily/flex; "Retorno entre Lojas" auto-applies when pickup/return locations differ), and card-installment interest.
  - **Business rules & minuta (contract note)**: `rules` (admin-configured day/hour thresholds) drive on-screen warnings; `getMinuta()` fills a supervisor-editable template (`settings` with `key: 'minuta'`, tokens like `{{FEITO_POR}}`, `{{PAGTO_BREAKDOWN}}`, `{{OBS_EXTRA}}`) to produce the final contract text, appending a liability warning when third-party protection is declined.
  - Has a client-facing "presentation mode" (`presentationMode`) that hides internal controls and only shows the price table + summary, meant to be shown on-screen to the customer.
- `pages/Supervisor.tsx` is a tabbed admin CRUD UI over every collection above, calling the generic REST endpoints directly with inline fetches (no API client layer/React Query) and refetching everything after each mutation (`fetchData()`).
- UI components (`src/components/ui/*`) are Radix UI primitives wrapped in a shadcn/ui-style pattern with `cn()` (`clsx` + `tailwind-merge`, in `src/lib/utils.ts`). Path alias `@/*` maps to repo root (see `tsconfig.json`/`vite.config.ts`), so imports look like `@/src/components/ui/card`.
- Styling: Tailwind v4 via `@tailwindcss/vite` plugin; dark mode toggled by adding/removing a `dark` class on `<html>`, persisted to `localStorage('theme')` — each page manages this independently (duplicated logic between `Vendedor.tsx` and `Supervisor.tsx`).

## Notable data-model conventions

- IDs for new records created client-side use `Date.now()`; `Supervisor.tsx`'s `handleSave` infers PUT vs POST by checking `data.id > 1000` (a `Date.now()` timestamp) as a proxy for "already persisted."
- `categories`/`taxes` support an `active` flag; inactive ones are filtered out server-side in `/api/system-params` but still shown/editable in the Supervisor admin UI.
- `taxes.tipo` is one of `fixo` (flat one-time), `diario` (per-day), `flex` (per-day, admin/vendor-entered amount via `flex_value`/`taxasFlexValues`).
