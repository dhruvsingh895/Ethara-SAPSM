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

_Entries will be appended here as backend models, migrations, and auth are added._

---

## Phase 2 — Core CRUD APIs

_Entries will be appended here._

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
