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
11. [Performance](#performance)
12. [Scaling](#scaling)
13. [Architectural Decisions](#architectural-decisions)
14. [Deployment](#deployment)
15. [Debugging Notes](#debugging-notes)
16. [Submission Checklist](#submission-checklist)

---

## Live URLs

| Service   | URL                                                    |
| --------- | ------------------------------------------------------ |
| Frontend  | https://ethara-sapsm.vercel.app                        |
| Backend   | https://ethara-sapsm.onrender.com                      |
| Swagger   | https://ethara-sapsm.onrender.com/docs                 |
| OpenAPI   | https://ethara-sapsm.onrender.com/openapi.json         |
| Repo      | https://github.com/dhruvsingh895/Ethara-SAPSM          |

**Demo accounts** — password `demo1234` for all:

| Username   | Role     |
| ---------- | -------- |
| `admin`    | Admin    |
| `hr`       | HR       |
| `pm`       | PM       |
| `employee` | Employee |

> First request after 15 min idle takes ~30s (Render free-tier cold start).

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
| POST   | `/api/v1/ai/query`                  | Natural-language query               |

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

## Performance

Live measurements against the deployed backend (Render free tier + Neon free tier). Full detail in [`docs/perf/README.md`](docs/perf/README.md).

**k6 load test — 5 concurrent virtual users, 20 seconds, 217 requests**

| Endpoint | p50 | p95 | Error rate |
| --- | --- | --- | --- |
| `GET /employees` | 193 ms | **342 ms** | 0.00% |
| `GET /seats` (200 rows) | 252 ms | **407 ms** | 0.00% |
| `GET /dashboard/overview` (5 aggregates) | 248 ms | **349 ms** | 0.00% |
| `GET /allocations` | 208 ms | **308 ms** | 0.00% |

**Query performance on live Neon.** Every hot-path query uses an index. No sequential scans on any table larger than 30 rows. Full `EXPLAIN ANALYZE` output in [`docs/perf/queries.md`](docs/perf/queries.md).

| Query | Plan | Execution time |
| --- | --- | --- |
| Employees count by dept + status | **Index-Only Scan** on `ix_employees_dept_status` | **0.34 ms** |
| Active allocation lookup by seat | Index Scan on `ix_alloc_seat_active` | **2.17 ms** |
| Dashboard seat status pie | **Index-Only Scan** on `ix_seats_status_floor` | **1.16 ms** |
| Dashboard top 5 departments | **Index-Only Scan** on `ix_employees_dept_status` | **1.12 ms** |

The stress test (50 concurrent VUs) reaches ~2.7s p95 — this is Render free-tier CPU saturation, not a database bottleneck. See [Scaling](#scaling) for the specific moves that eliminate it.

---

## Scaling

The system scales through platform tier upgrades and one architectural change per order of magnitude. No rewrite is required at any tier.

### Current — up to ~10,000 employees

- Render Free (0.1 vCPU, 512 MB RAM) + Neon Free (0.5 GB, 190 CPU-h/mo).
- Handles 5 concurrent users at p95 ≈ 350 ms (verified above).
- Cold starts (~30 s) after 15 min idle; keep warm with a UptimeRobot ping.

### 50,000 employees

- **Backend:** Render **Starter** ($7/mo — 0.5 vCPU, 512 MB RAM). This alone drops 50-VU p95 from 2.7 s back under 500 ms.
- **DB:** Neon Free is still fine (0.5 GB comfortably fits ~200k rows across our tables).
- **App:** No code changes. Existing composite indexes still cover the hot paths.

### 500,000 employees

- **Backend:** Render **Standard** or move to Fly.io with 2 machines behind their built-in load balancer.
- **DB:** Neon **Launch** tier ($19/mo, 10 GB) plus **read replica** for dashboard aggregates.
- **App changes:**
  - Route `/dashboard/*` reads to the read replica (one-line SQLAlchemy engine change).
  - Add **cursor pagination** on `/employees` and `/allocations` — `OFFSET` gets expensive past 100k rows.
  - Materialized view on the top-departments and floor-occupancy aggregates, refreshed every ~5 min.
- **Frontend:** No changes. React Query for stale-while-revalidate would help perceived latency but isn't required.

### 5,000,000 employees

- **Backend:** Auto-scaling behind Cloudflare in front of Vercel. The endpoints are all stateless.
- **DB:** Sharded Postgres or migration to a distributed OLTP store (Aurora, CockroachDB). Neon Business tier if we can stay single-writer.
- **App changes:**
  - **Redis** in front of `/employees/{id}`, `/seats/{id}`, and `/dashboard/*` — read-mostly endpoints with high cache hit potential.
  - **Elasticsearch or Postgres full-text search** for `q=` on employees — `ILIKE '%q%'` degrades at 5M rows even with a trigram index.
  - **Event bus** (Kafka or Redpanda) for the audit log, split away from the primary DB. Currently we write it synchronously in the same transaction as the mutation; at this scale that's contention.
  - **Bulk import** endpoint for HR — the seed script pattern extended to a real feature.
- **AI Assistant:** the current NL-to-SQL is fine. What changes is that we start caching common queries and using Gemini's context caching feature to keep the schema warm across requests.

### What we would NOT do

- **Microservices.** The domain is too small. Splitting employees, seats, projects into separate services adds network hops and consistency headaches for no scaling benefit at any tier below 50M rows.
- **Kubernetes.** Overkill for anything below the top tier. A managed platform (Render, Fly, Vercel) handles rollouts, cert management, and scaling with far less operational cost.
- **Multi-region.** SAPSM is an internal HR tool. Users are geographically clustered. Multi-region would burn engineer time on eventual-consistency debates for latency wins users can't perceive.

---

## Architectural Decisions

Short, dated records of the non-obvious choices in this project. Each ADR explains the context, options considered, decision, and consequences accepted. See [`docs/adr/`](docs/adr/).

| ID | Decision |
| --- | --- |
| [ADR-001](docs/adr/001-neon-over-supabase-and-render-postgres.md) | Neon over Supabase and Render Postgres |
| [ADR-002](docs/adr/002-nl-to-sql-with-guardrails-over-tool-use.md) | NL-to-SQL with guardrails over LLM tool-use |
| [ADR-003](docs/adr/003-single-neon-db-for-local-and-prod.md) | Single Neon DB for local dev and production |
| [ADR-004](docs/adr/004-fk-cycle-with-use-alter-over-denormalization-purge.md) | FK cycle with `use_alter` over dropping denormalized columns |
| [ADR-005](docs/adr/005-recharts-with-custom-tooltip-content.md) | Recharts with a custom Tooltip content component |
| [ADR-006](docs/adr/006-gemini-flash-over-huggingface.md) | Gemini 2.5 Flash over a self-hosted HuggingFace model |

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

- [x] GitHub Repository URL — https://github.com/dhruvsingh895/Ethara-SAPSM
- [x] Live Frontend URL — https://ethara-sapsm.vercel.app
- [x] Live Backend URL — https://ethara-sapsm.onrender.com
- [x] README.md — this file
- [x] [AI_PROMPTS.md](AI_PROMPTS.md)
- [x] Database Schema — [`docs/schema.md`](docs/schema.md)
- [x] Seed Data — [`backend/app/seed.py`](backend/app/seed.py) (5000 employees, 6000 seats, 30 projects live on Neon)
- [x] API Documentation / Swagger URL — https://ethara-sapsm.onrender.com/docs
- [x] Screenshots — [`docs/screenshots/`](docs/screenshots/) (8 shots covering login, dashboard, seat map, new-joiner flow, AI assistant, employees, projects)
- [x] Deployment Notes — [`docs/deployment.md`](docs/deployment.md)
- [x] Debugging Notes — [`docs/debugging.md`](docs/debugging.md)

### Beyond the checklist

- [x] Performance evidence — [`docs/perf/`](docs/perf/) — k6 load test + `EXPLAIN ANALYZE` on live Neon
- [x] AI safety analysis — [`docs/ai_safety.md`](docs/ai_safety.md) — threat model + 5-layer defense + test evidence
- [x] Architectural Decision Records — [`docs/adr/`](docs/adr/) — 5 dated ADRs
- [x] RBAC audit script — [`backend/scripts/rbac_audit.py`](backend/scripts/rbac_audit.py) — probes all 52 role×endpoint combos on live prod (52/52 pass)
- [x] CI on GitHub Actions — [`.github/workflows/ci.yml`](.github/workflows/ci.yml) — ruff, guard tests, typecheck, lint, build on every push

---

## License

MIT — see [LICENSE](LICENSE).
