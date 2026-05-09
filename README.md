# tora-app

The main React app for [TORA](https://app.torahub.io) — where members log in, manage profiles, search, message, book deals, and run tours. Hosted at `app.torahub.io`.

The other two repos in the system:
- [`tora-application`](https://github.com/alecastel91/tora-application) — public site + admin at `torahub.io`
- [`tora-backend`](https://github.com/alecastel91/tora-backend) — Express + Prisma API

> **Repo history note**: this repo is sometimes referred to as `tora-app-sql` in code/docs (PostgreSQL frontend, distinguishing it from the legacy MongoDB version that has been archived). The GitHub repo was renamed from `tora-appVisibility` to `tora-app` on 2026-05-09.

## Tech stack

- React 18 (functional components, hooks)
- Vite 6 (migrated from Create React App on 2026-04-10)
- React Router DOM 6
- Framer Motion
- Plain CSS (Tailwind migration in progress, see CLAUDE.md Phase 6)
- [Supabase Realtime](https://supabase.com/docs/guides/realtime) (Broadcast channels) for chat + inbox updates
- [Sentry](https://sentry.io) for error monitoring
- Hosted on Vercel; auto-deploys from `main`

## Local setup

```bash
git clone https://github.com/alecastel91/tora-app.git
cd tora-app
npm install
cp .env.example .env                   # then fill in real values — see SECRETS.md
npm run dev                             # localhost:3002 (or alessandro.local:3002 via mDNS)
```

You'll need: `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_APPLY_URL`, `VITE_SENTRY_DSN`. None of these are real secrets (Vite inlines them into the browser bundle, which is by design — Supabase anon keys + Sentry DSNs are public-by-design).

The backend (`tora-backend`) needs to be running locally on port 5002 for full functionality, OR you can point `VITE_API_URL` at the Railway production URL.

## Useful commands

| | |
|---|---|
| `npm run dev` | Local dev server on port 3002 (binds 0.0.0.0 for phone access) |
| `npm run build` | Production build |
| `npm run preview` | Serve the build locally |

## Project structure

```
src/
├── components/
│   ├── common/           # Reusable UI (Header, TabBar, Modal, Calendar, etc.)
│   └── screens/          # Top-level routes (Login, Signup, Profile, Bookings, etc.)
├── contexts/             # AppContext (likes/connections/profile state) + LanguageContext
├── services/
│   ├── api.js            # Backend API client (all REST calls)
│   ├── realtime.js       # Supabase Broadcast subscriptions
│   ├── contractService.js
│   └── raService.js      # Resident Advisor integration
├── styles/App.css        # 13K+ LOC, plain CSS (Tailwind migration ongoing)
├── translations/         # EN + JP
└── index.js              # Entry — Sentry init + ErrorBoundary lives here
```

## Documentation

- **`claude.md`** — full project context, recent updates, architecture decisions
- **`SECRETS.md`** — secret hygiene reference (mostly says "nothing here is a real secret")

## Conventions

- Pre-commit: husky runs `gitleaks protect --staged` to block accidental secret leaks
- Push to `main` auto-deploys to Vercel production
- All entity IDs are PostgreSQL UUIDs (never MongoDB ObjectIds — that codebase is archived); `id` field, never `_id`
- mDNS hostname: `.env` uses `alessandro.local` instead of LAN IP for stability across WiFi networks (see [local_dev_hostname memory](https://github.com/alecastel91/tora-app))
