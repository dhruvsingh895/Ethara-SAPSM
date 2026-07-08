# AI Usage Log — Ethara SAPSM

This file documents every meaningful use of AI tooling during the development of this project, per the assessment requirement:

> "All AI usage must be documented in an AI_PROMPTS.md file, including prompts used, outputs generated, manual fixes applied, and validation methods."

**AI tools used in this project:**

- **Claude (Anthropic)** via Claude Code CLI — primary pair-programming assistant.
- **Google Gemini 2.0 Flash** — embedded in the shipped app as the natural-language query assistant.

All entries are ordered chronologically. Each entry follows the schema:

```
### <N>. <Short title> — <YYYY-MM-DD>
**Tool:** <name>
**Phase:** <phase of development>
**Prompt (summary):** <one-line summary of what was asked>
**Output (summary):** <what was generated>
**Manual fixes:** <what was edited by hand>
**Validation:** <how the output was verified>
```

---

## Table of Contents

- [Phase 0 — Project Setup](#phase-0--project-setup)
- [Phase 1 — Backend Foundation](#phase-1--backend-foundation)
- [Phase 2 — Core CRUD APIs](#phase-2--core-crud-apis)
- [Phase 3 — Business Logic](#phase-3--business-logic)
- [Phase 4 — Seed Data](#phase-4--seed-data)
- [Phase 5 — Frontend](#phase-5--frontend)
- [Phase 6 — AI Assistant (Gemini NL to SQL)](#phase-6--ai-assistant-gemini-nl-to-sql)
- [Phase 7 — Deployment](#phase-7--deployment)

---

## Phase 0 — Project Setup

### 1. Analyse assessment problem statement — 2026-07-08
**Tool:** Claude (Claude Code CLI)
**Phase:** Planning
**Prompt (summary):** "Analyse this problem statement and lay out specs and complete development cycle before building."
**Output (summary):** Structured breakdown into 8 functional modules (Employee Mgmt, Project Mapping, Seat Allocation, New Joiner, Search, Dashboard, AI Assistant, REST APIs), entity model (Employee/Seat/Project/Assignment/Allocation/User/AuditLog), a 7-phase development plan, and a matrix of tech-stack decisions.
**Manual fixes:** None — used as-is for planning.
**Validation:** Reviewed against the raw problem statement bullet-by-bullet to confirm coverage of all key requirements and submission artefacts.

### 2. Compare managed Postgres providers — 2026-07-08
**Tool:** Claude
**Phase:** Planning
**Prompt (summary):** "Compare Neon vs Supabase vs TiDB vs Render Postgres for a zero-cost deployment."
**Output (summary):** Table comparing free tiers, persistence guarantees, connection pooling, and cold-start behaviour; recommended Neon because it is true Postgres (assessment requirement), has a permanent free tier, and offers a built-in connection pooler that Render's free tier needs.
**Manual fixes:** None.
**Validation:** Cross-checked Neon's free-tier limits against the Neon pricing page before committing.

### 3. Root .gitignore, README, and AI_PROMPTS scaffold — 2026-07-08
**Tool:** Claude
**Phase:** Phase 0 setup
**Prompt (summary):** "Set up base project files: .gitignore excluding .claude and secrets, README describing the app, AI_PROMPTS log, LICENSE."
**Output (summary):** This file, [README.md](README.md), [.gitignore](.gitignore), and [LICENSE](LICENSE).
**Manual fixes:** None yet — files are stable placeholders that will grow through later phases.
**Validation:** `git status` confirmed `.env`, `.claude/`, `node_modules/`, `.venv/`, `__pycache__/`, and IDE folders are all ignored. `problem-statement.txt` intentionally left untracked (assessment brief, not a project artefact).

### 4. FastAPI backend scaffold — 2026-07-08
**Tool:** Claude
**Phase:** Phase 0 setup
**Prompt (summary):** "Scaffold a FastAPI backend with async SQLAlchemy, Alembic, config via pydantic-settings, health check endpoints, and a Dockerfile."
**Output (summary):** `backend/` tree — `app/main.py` factory with CORS + versioned `/api/v1`, `app/core/config.py` typed settings, `app/db/{base,session}.py` async engine, `app/api/v1/endpoints/health.py` with `/health` and `/health/db`, Alembic env wired to `database_url_sync`, Dockerfile, `.env.example`, and a local `docker-compose.yml` for Postgres 16.
**Manual fixes:** Chose `pool_pre_ping=True` + moderate pool sizes to survive Neon's idle-pause cold starts. Health check split into cheap `/health` (no DB) and explicit `/health/db` (SELECT 1) so uptime pings don't burn Neon compute-hours unnecessarily.
**Validation:** AST-parsed every `.py` file under `backend/` to confirm zero syntax errors before committing. Full runtime validation happens once `pip install` runs and Phase 1 models are added.

### 5. Next.js frontend scaffold — 2026-07-08
**Tool:** Claude
**Phase:** Phase 0 setup
**Prompt (summary):** "Scaffold a Next.js 14 (App Router) + Tailwind + TypeScript frontend without running create-next-app so the initial commit is clean."
**Output (summary):** `frontend/` tree — `package.json` with Next 14, React 18, Tailwind, Recharts, lucide-react; strict `tsconfig.json`; `tailwind.config.ts` with a dedicated seat-status colour palette (available/occupied/reserved/blocked) for the Phase 5 seat map; landing page + `/health` server-rendered page that hits the backend liveness probe; `apiUrl()` helper reading `NEXT_PUBLIC_API_URL`.
**Manual fixes:** Skipped `create-next-app` because it is interactive and pulls a full `node_modules` — hand-scaffolded files instead so the repo stays lean and `npm install` populates deps on any machine. Pinned Next to 14.2.15 (App Router stable) rather than 15 to avoid churn during the assessment window.
**Validation:** `package.json` parsed with `JSON.parse`. TypeScript/JSX will be fully validated once `npm install` runs (`npm run typecheck`).

### 6. Deployment configs (Render + Vercel) — 2026-07-08
**Tool:** Claude
**Phase:** Phase 0 setup
**Prompt (summary):** "Add render.yaml and vercel.json so deployment is reproducible from the repo, with secrets kept out of source."
**Output (summary):** `render.yaml` provisioning the backend web service with health check path and build/start commands; `frontend/vercel.json` pinning framework preset and commands.
**Manual fixes:** All sensitive env vars (`DATABASE_URL`, `AI_READER_DATABASE_URL`, `JWT_SECRET`, `GEMINI_API_KEY`, `CORS_ORIGINS`, `SEED_DEMO_PASSWORD`) marked `sync: false` in `render.yaml` so Render's dashboard prompts to set them per environment — they never live in the repo. Region set to `singapore` to keep near typical Neon regions.
**Validation:** YAML/JSON parsed successfully. Live validation will happen when the first push triggers a Render preview and a Vercel import.

---

## Phase 1 — Backend Foundation

### 7. Domain models and initial Alembic migration — 2026-07-08
**Tool:** Claude
**Phase:** Phase 1
**Prompt (summary):** "Build SQLAlchemy 2.0 models for User, Employee, Seat, Project, ProjectAssignment, SeatAllocation, AuditLog, AiQueryLog with sensible indexes and relationships. Generate the first Alembic migration and apply it to Neon."
**Output (summary):** `backend/app/models/` package with 8 model modules, a shared `enums.py`, `mixins.py` for timestamps, and a re-export `__init__.py`. Alembic autogenerate produced revision `382bc0c49159` creating all 8 tables plus their indexes; applied successfully to Neon.
**Manual fixes:** Alembic autogenerate warned about a mutual FK cycle between `employees.current_project_id` and `projects.pm_id` (unresolvable table sort). Added `use_alter=True` on both FKs so Alembic emits them as separate ALTER TABLE after the initial CREATE, quieting the warning and making CREATE order irrelevant. Also picked composite indexes deliberately (`ix_alloc_seat_active(seat_id, released_at)`, `ix_alloc_emp_active(employee_id, released_at)`) so "find the currently-active allocation" queries hit the index directly.
**Validation:** After migration, ran `SELECT table_name FROM information_schema.tables WHERE table_schema='public'` on Neon and confirmed all 8 tables plus `alembic_version` exist. Verified mapper wiring by running `sqlalchemy.orm.configure_mappers()` before generating the migration — this catches broken relationships eagerly.

### 8. JWT auth (login, bearer, role guards) — 2026-07-08
**Tool:** Claude
**Phase:** Phase 1
**Prompt (summary):** "Add JWT auth: bcrypt password hashing, `create_access_token` / `decode_token` helpers, `/auth/login` (OAuth2 password form flow so Swagger's Authorize button works), `/auth/me`, and a `require_roles(...)` dependency factory."
**Output (summary):** `app/core/security.py` (passlib + jose), `app/api/deps.py` (`get_current_user`, `require_admin`, `require_hr_or_admin`, `require_pm_or_admin`), `app/api/v1/endpoints/auth.py` with login (accepts username OR email) and `/me`, `app/schemas/auth.py`, and `app/bootstrap.py` — an idempotent script that creates one user per role for local grading.
**Manual fixes:** Two bugs hit during smoke test, both fixed in the same commit chain:
- `passlib==1.7.4` crashes on `bcrypt>=4.1` because it probes `bcrypt.__about__.__version__` which was removed. Pinned `bcrypt==4.0.1` in `requirements.txt`.
- `pydantic.EmailStr` rejects `.local` per RFC 6761 (special-use TLD), so serializing the seeded `admin@ethara.local` through the login response 500'd. Switched demo emails to `@ethara.dev` and downgraded `UserPublic.email` from `EmailStr` to plain `str` (output schema — DB is the source of truth). Both incidents logged in [`docs/debugging.md`](docs/debugging.md).
**Validation:** End-to-end smoke test against live Neon:
- `POST /auth/login` with `admin`/`demo1234` returned a JWT and the user payload.
- `GET /auth/me` with the token returned the correct user.
- Wrong password → 401 `Incorrect username or password`.
- Missing token → 401 `Not authenticated`.
Round-tripped `hash_password` / `verify_password` and `create_access_token` / `decode_token` in isolation before wiring the endpoint.

---

## Phase 2 — Core CRUD APIs

### 9. Shared pagination and audit helpers — 2026-07-08
**Tool:** Claude
**Phase:** Phase 2
**Prompt (summary):** "Add a shared `Page[T]` response schema, `PageParams` FastAPI dependency, and an `audit.record()` helper so every mutation endpoint writes one audit row without repeating the same code."
**Output (summary):** `app/schemas/common.py` (`Page`, `PageParams`, `MessageResponse`) and `app/services/audit.py` (single `record()` coroutine that appends to `audit_log`).
**Manual fixes:** Kept `audit.record()` non-committing — the caller commits after all changes so audit rows land in the same transaction as the mutation they describe. Caps `limit` at 200 in `PageParams` to keep responses small.
**Validation:** Both modules used by every subsequent endpoint in Phase 2 and exercised by the smoke test.

### 10. Employees, seats, projects, and assignments CRUD — 2026-07-08
**Tool:** Claude
**Phase:** Phase 2
**Prompt (summary):** "Build CRUD endpoints for employees, seats, projects, and project assignments. Query-param filters, offset pagination, ILIKE search on obvious columns, role guards per resource, and audit-log writes on every mutation."
**Output (summary):** Four endpoint modules under `app/api/v1/endpoints/` (`employees`, `seats`, `projects` includes `/roster` + nested `/assignments`) and matching schemas under `app/schemas/`. 24 total endpoints registered; role guards: HR/Admin for employees, Admin for seats/projects, PM/Admin for assignments. Seat delete refuses OCCUPIED seats. Available-seats endpoint sorts by building/floor/zone/seat_number for stable UI listing.
**Manual fixes:** For seat/project mutations, chose `PATCH` (partial update via `model_dump(exclude_unset=True)`) rather than `PUT` — safer against clients that don't send all fields. Added a URL-vs-body project_id sanity check on assignment creation (400 if mismatched). Kept `active_only=True` as the default on roster to hide expired rows.
**Validation:** Wrote `backend/scripts/smoke_test.py` — creates seat/project/employee/assignment, verifies filters/search/roster, patches a field, checks that a non-admin cannot delete a project, then cleans up. Ran against live Neon: 17/17 checks passed.

---

## Phase 3 — Business Logic

_Entries will be appended here as seat allocation, release, transfer, and new-joiner suggestion logic are added._

---

## Phase 4 — Seed Data

_Entries will be appended here when the 5k-employee seed generator is built._

---

## Phase 5 — Frontend

_Entries will be appended here as Next.js pages and components are built._

---

## Phase 6 — AI Assistant (Gemini NL to SQL)

_This section will document:_
- _Prompt engineering for the Gemini NL-to-SQL system prompt (schema-only context)._
- _Guardrail regex and SQL-allowlist parser design._
- _Manual testing of adversarial prompts (attempted `INSERT`, `DROP`, cross-table joins to `users`)._

---

## Phase 7 — Deployment

_Entries will be appended here for Render, Vercel, and Neon deployment steps._

---

## Reproducibility

- The Claude Code CLI transcripts for each session are archived locally under `~/.claude/projects/`. They are not committed (they contain machine-specific paths), but the meaningful prompts and outputs are summarised above.
- All AI-generated code that ships in the repo has been reviewed line-by-line and validated via one or more of: (a) running the code locally, (b) unit/integration tests, (c) manual smoke tests against the running app.
