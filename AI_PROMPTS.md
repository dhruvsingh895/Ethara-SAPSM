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

### 11. Allocation service (allocate / release / transfer) — 2026-07-08
**Tool:** Claude
**Phase:** Phase 3
**Prompt (summary):** "Build the seat allocation service that atomically moves three tables: seats.status, employees.current_seat_id, and appends a seat_allocations row. Wrap it in HR/Admin-guarded endpoints for allocate, release, and transfer."
**Output (summary):** `app/services/allocation.py` with `allocate()`, `release()`, `transfer()`. Each function flushes but does not commit — the calling endpoint commits so the whole mutation lands in one transaction. Endpoints in `app/api/v1/endpoints/allocations.py` cover `GET /allocations` (with active_only, employee_id, seat_id filters), `GET /allocations/{id}`, `POST /allocations`, `POST /allocations/{id}/release`, and `POST /allocations/transfer`.
**Manual fixes:** Two invariants added defensively:
- allocate refuses non-AVAILABLE seats and refuses employees who already occupy a seat (409). Enforces "release or transfer" as the only path off an existing seat.
- transfer reuses release + allocate rather than editing rows in place, so history is complete and audit trail shows both events plus a `TRANSFER` marker.
**Validation:** Smoke test exercised: allocate → seat OCCUPIED, employee.current_seat_id set → double-allocate rejected (409) → transfer → old seat AVAILABLE, new seat OCCUPIED → release → employee.current_seat_id cleared. All state changes verified via `GET /seats/{id}` and `GET /employees/{id}` after each step.

### 12. New-joiner seat suggestion — 2026-07-08
**Tool:** Claude
**Phase:** Phase 3
**Prompt (summary):** "Suggest N vacant seats for a new joiner, ranked by proximity to their future team (department or project). Fall back to same floor, then anywhere."
**Output (summary):** `app/services/new_joiner.py` with `suggest_seats()`, plus `POST /new-joiner/suggest`, `GET /new-joiner/suggest` (query-param variant for Swagger tinkering), and `POST /new-joiner/allocate` which delegates to the standard allocation service.
**Manual fixes:** Chose a 3-tier fallback: same (building, floor, zone) → same (building, floor) → any AVAILABLE. Ranks hotspots by how many teammates already sit there, so a densely-populated zone wins over a sparse one. Ties broken deterministically by `seat_number` so the same call returns the same suggestion — makes the UI stable.
**Validation:** Smoke test asserts the endpoint returns a list (may be empty until Phase 4 seed populates teammates). Manual Swagger tests will follow after seed.

### 13. Dashboard aggregate endpoints — 2026-07-08
**Tool:** Claude
**Phase:** Phase 3
**Prompt (summary):** "Add dashboard aggregates the frontend will call: overall seat occupancy, by-floor breakdown, project utilization (active members vs required seats), and a landing-page overview."
**Output (summary):** `app/api/v1/endpoints/dashboard.py` with `GET /dashboard/occupancy`, `/occupancy/by-floor`, `/projects/utilization`, and `/overview`. Response schemas in `app/schemas/dashboard.py`. Overview bundles the occupancy summary with active employee count, 30-day joiner count, active project count, and top 5 departments by headcount.
**Manual fixes:** Utilization query joins ProjectAssignment via a subquery filtered to `end_date IS NULL OR end_date >= today` so historical assignments don't inflate the count. Used `func.count(func.distinct(employee_id))` so an employee counted once even with multiple concurrent role rows on the same project.
**Validation:** Smoke test hits all 4 endpoints and checks response shape. Values will be more meaningful once Phase 4 seed lands 5k employees; today the tables are near-empty so numbers are small but non-zero (4 users, 0 seats).

---

## Phase 4 — Seed Data

### 14. 5,000-employee realistic seed — 2026-07-08
**Tool:** Claude
**Phase:** Phase 4
**Prompt (summary):** "Write `app/seed.py` that populates the DB with a realistic dataset: 3 buildings x 5 floors x 4 zones (~6k seats), 5000 active + 300 exited employees across 8 weighted departments, 30 projects with long-tail sizes, project assignments summing to <=100%, and ~80% seat occupancy. Idempotent with `--wipe`, deterministic with a fixed Faker seed."
**Output (summary):** `backend/app/seed.py` with `argparse` (`--wipe`, `--small`), a `_wipe()` that handles FK cycles, and a `seed()` coroutine that builds seats -> employees -> projects -> assignments -> allocations in dependency order. Departments cluster into preferred zones so teammates sit near each other — the new-joiner suggestion algorithm from Phase 3 uses this.
**Manual fixes:** Two real bugs hit and fixed during Phase 4:
1. **UniqueViolation on `projects.name`** — my initial name generator picked from 10 prefixes x 8 suffixes = 80 combos, and the pigeonhole principle guaranteed collisions at 30 projects. Fix: appended `f"{i:02d}"` to every project name so uniqueness is guaranteed.
2. **Utilization values in the thousands of percent** — first run distributed assignments too uniformly (avg 1.2 per active employee); with 5k employees across 23 active projects that's ~265 members per project vs required_seats of 5-200. Tuned two knobs: `n_assign` weights to `[0.1, 0.82, 0.08]` (most people on one project only) and `required_seats` bumped to a realistic 25-500 range. Utilization now lands in a believable spread (0% completed / 40% under / 400%+ over).
**Validation:** Post-seed verification query on Neon:
- 6,000 seats, 80/15/3/2% status split — exactly matches target.
- 5,000 active + 300 exited employees; Engineering 34.5% / Product 10.4% / etc — matches weighted config within noise.
- Dashboard `/overview` returns correct totals; `/occupancy/by-floor` shows floors ranging 75-90% occupied (natural randomness); `/projects/utilization` shows a healthy mix; `/new-joiner/suggest` for "Engineering" returns seats in Engineering's clustered zone (B3-F3 in the current seed).

---

## Phase 5 — Frontend

### 15. Auth-aware Next.js UI (dashboard, employees, seats, projects, allocations) — 2026-07-08
**Tool:** Claude
**Phase:** Phase 5
**Prompt (summary):** "Build the Next.js frontend: typed API client, JWT auth context, login page, protected route group with role-aware sidebar, dashboard with Recharts, employees list+detail, seats grid, projects+roster, new-joiner allocation flow, allocations list with release."
**Output (summary):**
- `src/lib/api.ts` — `apiFetch<T>()` wrapper handling JSON/form bodies, bearer tokens, 401 auto-clear, and typed errors via `ApiError`.
- `src/lib/types.ts` — full mirror of backend Pydantic schemas.
- `src/lib/auth-context.tsx` — `useAuth()` provider (login, logout, hasRole).
- `src/app/login/page.tsx` — login form with 4 demo-account chips.
- `src/app/(app)/layout.tsx` + `AppShell` — route group with sidebar (role-filtered nav) + top bar + logout.
- `src/app/(app)/dashboard/page.tsx` — 4 stat cards, seat-status pie, top-departments bar, floor-occupancy stacked bar, top project utilization table with over/under colour coding.
- `src/app/(app)/employees/{page,[id]/page}.tsx` — filterable list with search + department + status, paginated; detail shows profile, current seat, current project.
- `src/app/(app)/seats/page.tsx` — building/floor/status filters, colour-coded seat grid by zone, click-to-inspect side panel.
- `src/app/(app)/projects/{page,[id]/page}.tsx` — filterable list; detail shows profile + active roster.
- `src/app/(app)/new-joiner/page.tsx` — 3-step wizard (suggest → pick → allocate) gated to HR/Admin.
- `src/app/(app)/allocations/page.tsx` — filterable list with inline release (HR/Admin).
- `src/components/ui.tsx` — hand-rolled `Card`, `Stat`, `Badge`, `TableShell` atoms; no shadcn install churn.
**Manual fixes:** Three real issues hit and fixed during Phase 5:
1. **npm audit surfaced a critical Next.js advisory** on the initially-pinned `14.2.15`. Bumped both `next` and `eslint-config-next` to `14.2.35` (latest 14.x patch) — clears the critical, keeps App Router compatibility. Deliberately did **not** jump to 15+ because of the fetch-cache and dynamic-API breaking changes.
2. **Prerender error on `/login`** — `useSearchParams()` in Next 14 App Router requires a Suspense boundary during static export. Wrapped the form in a `<Suspense>` boundary with a "Loading…" fallback and split the component into `LoginPage` shell + `LoginForm` child.
3. **A11y diagnostic on inputs missing labels** — even with visual `<label>` wraps, IDE flagged the inputs; fixed by adding explicit `id`/`htmlFor` associations, `name`, and `placeholder`. Adds nothing at runtime but silences the linter and improves screen-reader behaviour.
**Validation:** `npm run typecheck` clean (0 errors). Full `npm run build` succeeds with 11 routes prerendered (8 static, 2 dynamic). Every page returns HTTP 200 from the production server. Bundle sizes reasonable — dashboard 106KB (Recharts), everything else under 4KB per route (client bundle) + 87KB shared. **Not** driven end-to-end in a real browser by AI tooling — user is expected to click through once before deployment to verify visual layout and chart rendering with the live 5k dataset.

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
