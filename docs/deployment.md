# Deployment Notes

Detailed step-by-step deployment guide. Will be populated as each service is deployed.

## Overview

| Service   | Provider | Config file           |
| --------- | -------- | --------------------- |
| Backend   | Render   | [`render.yaml`](../render.yaml)   |
| Frontend  | Vercel   | [`frontend/vercel.json`](../frontend/vercel.json) |
| Database  | Neon     | See [`neon_setup.md`](neon_setup.md) |

## Backend (Render)

1. Sign in to Render, click **New Web Service**, connect this GitHub repo.
2. Configure:
   - **Root Directory:** `backend`
   - **Environment:** Python 3.11
   - **Build command:** `pip install -r requirements.txt && alembic upgrade head`
   - **Start command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
3. Add environment variables (see [README — Environment Variables](../README.md#environment-variables)).
4. Deploy.

## Frontend (Vercel)

1. Sign in to Vercel, click **Add New Project**, import this repo.
2. Configure:
   - **Root Directory:** `frontend`
   - **Framework Preset:** Next.js (auto-detected)
3. Set env: `NEXT_PUBLIC_API_URL` = the Render backend URL.
4. Deploy.

## Database (Neon)

See [`neon_setup.md`](neon_setup.md).

## Pre-deployment security checklist

Before pushing to production, all secrets used during local development
**must** be rotated. Local `.env` values are considered exposed.

- [ ] **Neon** — reset the `neondb_owner` password (or drop and recreate the role). Update `DATABASE_URL` and `DATABASE_URL_SYNC` on Render.
- [ ] **Neon `ai_reader`** — set a strong random password when creating the role (see [`neon_setup.md`](neon_setup.md)).
- [ ] **Gemini** — revoke the local `GEMINI_API_KEY` at https://aistudio.google.com/app/apikey and issue a new one for production.
- [ ] **JWT_SECRET** — generate a fresh 32-byte hex string (`openssl rand -hex 32`) for production. Do not reuse the local dev secret.
- [ ] **SEED_DEMO_PASSWORD** — change from `demo1234` before public exposure, or disable seeded demo accounts entirely.
- [ ] Confirm no `.env` file is present in the Docker image (check `.dockerignore`).
- [ ] Confirm `CORS_ORIGINS` in Render lists only the Vercel domain, not `*`.

## Keeping free-tier services warm

Neon compute pauses after 5 minutes of inactivity. To keep it warm during grading:

- Set up **UptimeRobot** free monitor pinging `<backend-url>/health` every 5 minutes.
- Backend `/health` endpoint runs `SELECT 1` which keeps Neon compute active.
