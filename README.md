# Ethara SAPSM — Seat Allocation & Project Mapping System

A full-stack application to manage seat allocation and project mapping for approximately **5,000 employees**. Enables Employees, HR, Admin, and Project teams to manage seating, project assignments, availability, utilization metrics, and new-joiner allocations — with a natural-language AI query interface on top.

> **Assessment submission** — see [Submission Checklist](#submission-checklist) at the bottom for links to the live deployment, docs, and screenshots.

---

## Table of Contents

1. [Live URLs](#live-urls)
2. [Tech Stack](#tech-stack)
3. [Architecture](#architecture)
4. [Features](#features)
5. [Local Development](#local-development)
6. [Environment Variables](#environment-variables)
7. [Database Schema](#database-schema)
8. [Seed Data](#seed-data)
9. [API Documentation](#api-documentation)
10. [AI Assistant (NL to SQL)](#ai-assistant-nl-to-sql)
11. [Deployment](#deployment)
12. [Debugging Notes](#debugging-notes)
13. [Submission Checklist](#submission-checklist)

---

## Live URLs

| Service   | URL                                        |
| --------- | ------------------------------------------ |
| Frontend  | _to be added after Vercel deployment_      |
| Backend   | _to be added after Render deployment_      |
| Swagger   | _`<backend-url>/docs`_                     |
| Repo      | https://github.com/dhruvsingh895/Ethara-SAPSM |

---

## Tech Stack

| Layer         | Choice                                            | Why                                          |
| ------------- | ------------------------------------------------- | -------------------------------------------- |
| Frontend      | Next.js 14 (App Router) + Tailwind + shadcn/ui    | SSR, great DX, Vercel-native                 |
| Backend       | FastAPI + Pydantic v2 + SQLAlchemy 2.0 + Alembic  | Auto-Swagger, async, typed                   |
| Database      | PostgreSQL on **Neon** (serverless)               | True Postgres, permanent free tier, branching |
| Auth          | JWT (access + refresh) with role-based guards     | Stateless, simple                            |
| AI Assistant  | Google Gemini 2.5 Flash (free tier), NL to SQL    | Free, capable, low-latency                   |
| Charts        | Recharts                                          | React-native, composable                     |
| Deployment    | Backend on **Render**, Frontend on **Vercel**     | Zero cost, git-push deploys                  |

**Total infra cost: $0/month.**

---

## Architecture

```
+-------------------+          +-----------------------+          +---------------------+
|  Next.js (Vercel) | <------> |   FastAPI (Render)    | <------> |  Postgres (Neon)    |
|  - Employee views |   HTTPS  |   - REST + Swagger    |   TCP    |  - Primary schema   |
|  - Seat map grid  |          |   - JWT auth + RBAC   |          |  - ai_reader role   |
|  - Dashboards     |          |   - NL to SQL bridge  |          |    (SELECT only)    |
|  - AI chat panel  |          |                       |          |                     |
+-------------------+          +-----------+-----------+          +---------------------+
                                            |
                                            v
                                +-----------+-----------+
                                |  Gemini 2.0 Flash API |
                                |  (natural language)    |
                                +-----------------------+
```

---

## Features

### Core

- **Employee Management** — CRUD, bulk import, filter by dept/project/status.
- **Project Mapping** — assign / reassign employees, view roster, allocation %.
- **Seat Allocation & Release** — allocate, release, transfer, block, reserve. Full history.
- **New Joiner Allocation** — suggest a seat near the joiner's team/project.
- **Search & Filter** — by name, employee id, seat code, project, floor, zone, dept.
- **Dashboard & Analytics** — occupancy %, floor heatmap, project utilization, vacant seats, new joiners this month.
- **AI Assistant** — natural-language queries against the DB via Gemini, guarded by a read-only DB role.
- **REST APIs** — full OpenAPI/Swagger documentation.

### Roles

| Role     | Can do                                                         |
| -------- | -------------------------------------------------------------- |
| Employee | Search seats/people; view own profile & seat.                  |
| PM       | View & manage project roster.                                  |
| HR       | Create/edit employees, manage new-joiner allocations.          |
| Admin    | Everything, including seat blocking, project creation, audits. |

---

## Local Development

### Prerequisites

- **Python** 3.11+
- **Node.js** 20+
- **Docker Desktop** (optional — for local Postgres)
- A **Neon** account for the remote DB (or run local Postgres via Docker)

### 1. Clone

```bash
git clone https://github.com/dhruvsingh895/Ethara-SAPSM.git
cd Ethara-SAPSM
```

### 2. Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate            # Windows
# source .venv/bin/activate       # macOS/Linux

pip install -r requirements.txt
cp .env.example .env              # fill in DATABASE_URL, JWT_SECRET, GEMINI_API_KEY

alembic upgrade head              # apply migrations
python -m app.seed                # generate 5k employees (idempotent)
uvicorn app.main:app --reload     # http://localhost:8000  |  /docs for Swagger
```

### 3. Frontend

```bash
cd ../frontend
npm install
cp .env.example .env.local        # set NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev                       # http://localhost:3000
```

---

## Environment Variables

### Backend (`backend/.env`)

| Var                       | Example                                                 | Notes                          |
| ------------------------- | ------------------------------------------------------- | ------------------------------ |
| `DATABASE_URL`            | `postgresql+asyncpg://user:pw@ep-x.neon.tech/db`        | Neon pooled connection string  |
| `AI_READER_DATABASE_URL`  | `postgresql+asyncpg://ai_reader:pw@ep-x.neon.tech/db`   | SELECT-only role for AI        |
| `JWT_SECRET`              | `<random 32-byte hex>`                                  | `openssl rand -hex 32`         |
| `JWT_ALGORITHM`           | `HS256`                                                 |                                |
| `ACCESS_TOKEN_EXPIRE_MIN` | `60`                                                    |                                |
| `GEMINI_API_KEY`          | `AIza...`                                               | free at aistudio.google.com    |
| `CORS_ORIGINS`            | `http://localhost:3000,https://<vercel-domain>`         | comma-separated                |
| `ENVIRONMENT`             | `development` / `production`                            |                                |

### Frontend (`frontend/.env.local`)

| Var                    | Example                             |
| ---------------------- | ----------------------------------- |
| `NEXT_PUBLIC_API_URL`  | `http://localhost:8000`             |
| `NEXT_PUBLIC_APP_NAME` | `Ethara SAPSM`                      |

---

## Database Schema

Entities and key relations. Detailed ERD is in [`docs/schema.md`](docs/schema.md).

- `users` — auth credentials, roles.
- `employees` — profile, status, links to current seat + current project.
- `seats` — building / floor / zone / status.
- `projects` — client, PM, status, required seats.
- `project_assignments` — many-to-many `employees` ↔ `projects` with allocation %.
- `seat_allocations` — history of who sat where, when, allocated by whom.
- `audit_log` — mutation trail for allocations and role changes.
- `ai_query_log` — every NL query + generated SQL + result count.

Migrations live in `backend/alembic/versions/`.

---

## Seed Data

The seed generator produces a realistic dataset:

- **5,000 employees** across 8 departments, distributed by realistic ratios.
- **~30 projects** with 2–200 assignees each.
- **~6,000 seats** across **3 buildings × 5 floors × 4 zones**.
- **~80% occupied, ~15% vacant, ~5% reserved / blocked**.
- **4 pre-created users** — one per role (`admin`, `hr`, `pm`, `employee`) with password `demo1234` for grading.

Run: `python -m app.seed`. Idempotent — safe to re-run.

---

## API Documentation

FastAPI auto-generates OpenAPI. Once the backend is running:

- **Swagger UI** — http://localhost:8000/docs
- **ReDoc** — http://localhost:8000/redoc
- **OpenAPI JSON** — http://localhost:8000/openapi.json

Key routes:

| Method | Path                                | Purpose                               |
| ------ | ----------------------------------- | ------------------------------------- |
| POST   | `/auth/login`                       | Get JWT                               |
| GET    | `/employees`                        | List, filter, paginate                |
| POST   | `/employees`                        | Create (HR/Admin)                     |
| GET    | `/seats/available`                  | List free seats                       |
| POST   | `/allocations`                      | Allocate a seat                       |
| POST   | `/allocations/{id}/release`         | Release a seat                       |
| POST   | `/new-joiner/suggest`               | Suggest a seat for a joiner          |
| GET    | `/dashboard/occupancy`              | Occupancy metrics                    |
| POST   | `/ai/query`                         | Natural-language query               |

---

## AI Assistant (NL to SQL)

The assistant answers questions like:

- "How many empty seats on Floor 3?"
- "List all employees on Project Atlas."
- "Who sits next to Ankit Kumar?"

**Safety model:**

1. Gemini receives only the **schema** (DDL) — never user data.
2. Generated SQL is parsed and rejected if it contains any of: `INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, `TRUNCATE`, `GRANT`, `REVOKE`, `CREATE`, `COPY`.
3. Executed as the `ai_reader` Postgres role — **SELECT only**, no access to `users`/`password_hash`.
4. `SET statement_timeout = '3s'` per session — no runaway queries.
5. `LIMIT 100` auto-injected if the query has none.
6. Every request is logged to `ai_query_log` for audit.

---

## Deployment

### Backend on Render

1. New Web Service, connect this repo, root = `backend`.
2. Build: `pip install -r requirements.txt && alembic upgrade head`
3. Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. Add env vars from the table above.
5. `render.yaml` in the repo makes this reproducible.

### Frontend on Vercel

1. Import repo, root = `frontend`.
2. Framework preset: **Next.js** (auto-detected).
3. Env: `NEXT_PUBLIC_API_URL` = Render backend URL.

### DB on Neon

1. Create project at neon.tech. Pick region closest to Render.
2. Copy the **pooled** connection string into `DATABASE_URL`.
3. In the SQL Editor, create the read-only role for AI (see [`docs/neon_setup.md`](docs/neon_setup.md)).

Details: [`docs/deployment.md`](docs/deployment.md).

---

## Debugging Notes

Ongoing notes on issues hit and how they were resolved. See [`docs/debugging.md`](docs/debugging.md).

---

## Submission Checklist

- [ ] GitHub Repository URL — https://github.com/dhruvsingh895/Ethara-SAPSM
- [ ] Live Frontend URL
- [ ] Live Backend URL
- [ ] README.md — this file
- [ ] [AI_PROMPTS.md](AI_PROMPTS.md)
- [ ] Database Schema — [`docs/schema.md`](docs/schema.md)
- [ ] Seed Data — [`backend/app/seed.py`](backend/app/seed.py)
- [ ] API Documentation / Swagger URL — `<backend-url>/docs`
- [ ] Screenshots — [`docs/screenshots/`](docs/screenshots/)
- [ ] Deployment Notes — [`docs/deployment.md`](docs/deployment.md)
- [ ] Debugging Notes — [`docs/debugging.md`](docs/debugging.md)

---

## License

MIT — see [LICENSE](LICENSE).
