# Secrets — where they live and who owns rotation

Internal reference for tora-app-sql (the main React app). Keep this file but **never paste actual secret values into it** — only locations and rotation procedures.

## What this app actually uses

This is a Vite-built React app deployed to Vercel. **Almost nothing here is a real secret** — most env vars are public by design (`VITE_` and `NEXT_PUBLIC_` style prefixes mean they get bundled into the browser).

| Variable | Where it lives | Sensitive? | Note |
|---|---|---|---|
| `VITE_API_URL` | Vercel (Production) + local `.env` | ❌ Not a secret | Just the backend URL |
| `VITE_SUPABASE_URL` | Vercel (Production) + local | ❌ Not a secret | Public Supabase URL |
| `VITE_SUPABASE_ANON_KEY` | Vercel (Production) + local | ❌ Not a secret | Anon key — public-by-design |
| `VITE_APPLY_URL` | Vercel (Production) + local | ❌ Not a secret | Just the apply page URL |

**No "real" secrets in this repo.** The actual API auth happens via:
- JWT in `localStorage` (set by backend after login) — never present at build time
- Backend's `JWT_SECRET` — held only on Railway, never reaches this app

## Local dev secrets

`.env` (gitignored) holds:
- `VITE_API_URL=http://alessandro.local:5002/api` — local mDNS hostname
- `VITE_SUPABASE_*` — same as production (anon keys are public)
- `VITE_APPLY_URL=http://alessandro.local:3000/apply` — local landing page

If the local `.env` accidentally leaks, no production credential is exposed.

## After-incident response

Compromise of THIS repo's env vars is mostly a non-event because nothing here is truly secret. The real secrets to worry about are in `tora-application` (Resend, Admin password) and `tora-backend-sql` (DATABASE_URL, JWT_SECRET, INVITATION_API_KEY) — see those repos' `SECRETS.md`.

If somehow a non-public credential were committed here:

1. Identify the value and rotate it at its source.
2. Add fingerprint to `.gitleaksignore`.
3. Document below.

## Pre-commit defense

```bash
gitleaks detect --source . --no-banner
```

Currently scans clean (no findings).
