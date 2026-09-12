# Phone Cases Frontend

English-first ecommerce storefront frontend for phone cases and
accessories. Next.js (App Router) + TypeScript (strict) + Tailwind CSS.

This milestone implements the shared visual foundations and the
customer-facing homepage only. See `docs/FRONTEND_PROGRESS.md` for exactly
what is and isn't done, and `docs/DESIGN.md` for the visual system.

## Requirements

- Node.js v24+ and npm 11+ (developed against v24.15.0 / 11.12.1).

## Getting started

```bash
npm install
cp .env.example .env.local   # then edit values as needed
npm run dev
```

Open http://localhost:3000.

## Configuration

Set in `.env.local` (never committed — see `.gitignore`):

- `NEXT_PUBLIC_API_BASE_URL` — base URL of `phone-cases-backend`'s public
  API, **including** the `/api/v1` prefix, e.g.
  `http://192.168.1.7:3010/api/v1` for a backend on another machine on the
  local network, or `http://localhost:3010/api/v1` for one running
  locally.
- `NEXT_PUBLIC_DEMO_MODE` — `true` (default) renders the storefront with
  local, clearly-labeled fixture data instead of calling the backend.
  Set to `false` once a real backend is reachable at
  `NEXT_PUBLIC_API_BASE_URL`. No component changes are required to switch
  — see `src/lib/data/*`.

`.env.example` documents both with placeholders only; no secrets belong in
`NEXT_PUBLIC_*` variables.

## Commands

- `npm run dev` — start the dev server.
- `npm run build` — production build.
- `npm run start` — run the production build.
- `npm run lint` — ESLint.
- `npx tsc --noEmit` — TypeScript strict type-check.

## Project structure

```
src/app/                 Routes (homepage, /coming-soon, error boundary)
src/components/layout/   Header, footer
src/components/home/     Homepage sections
src/components/graphics/ Original placeholder vector illustrations
src/config/site.ts       Nav links, brand name, footer links (edit here,
                          not inside components)
src/lib/api/             Typed HTTP client + types matching the verified
                          backend contract
src/lib/data/            Data-access boundary: demo vs. live per resource
src/lib/demo/            Demo-only fixtures, clearly isolated from src/lib/api
```
