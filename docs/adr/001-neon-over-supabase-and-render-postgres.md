# ADR-001: Neon over Supabase and Render Postgres

**Date:** 2026-07-08 · **Status:** Accepted

## Context

The brief specifies "PostgreSQL (preferred)" and lists Render, Vercel, Railway, Netlify, and Fly.io as acceptable deploy targets. Total infra cost is a hard constraint (this is an assessment) — $0/mo across the stack. The DB needs to survive at least the length of a hiring cycle without being auto-deleted.

## Options

| Option | Free tier | Persistence | Cold start | Notes |
| --- | --- | --- | --- | --- |
| **Neon** | 0.5 GB, 190 compute-h/mo | ✅ permanent | ~500 ms | Serverless Postgres, branching, pooler included |
| **Supabase** | 500 MB, 2 projects | ⚠️ paused after 7 days idle | ~2 s | Bundled auth/storage we don't need |
| **Render Postgres** | 1 GB, 90 days | ❌ **deleted at 90 days** | none (always-on) | Would guarantee data loss mid-review |
| **TiDB Serverless** | 25 GB | ✅ permanent | none | Not Postgres — MySQL wire protocol |

## Decision

**Neon.**

## Consequences

**Accepted:** Compute pauses after 5 minutes of inactivity, giving a ~500ms cold hit on the first request. The `/health` endpoint stays cheap (no DB query) so uptime pings don't burn the compute-hours budget. `/health/db` exists for deep readiness checks when we explicitly want them.

**Gained:**

- True Postgres — no dialect divergence from the "PostgreSQL preferred" brief.
- Permanent free tier — grading window is safe from auto-delete.
- Built-in connection pooler — Render's free tier caps per-instance connections; without pooling we'd hit that ceiling under any real concurrency.
- Branching — like `git` for the DB. We haven't used this yet, but it's a cheap escape hatch if we ever need to isolate a schema experiment.

**Rejected explicitly:**

- **Render Postgres** — the 90-day auto-delete is disqualifying for anything expected to survive a review window.
- **Supabase** — the 7-day-idle pause creates a "did they forget to log in this week?" failure mode we can't afford.
- **TiDB** — jumping to MySQL just to save disk space would blow up the JSON types, full-text search config, and every Postgres-specific SQL the AI assistant emits.

## Related

- [ADR-003](003-single-neon-db-for-local-and-prod.md) — why we run local dev against the same Neon project instead of a separate branch.
- [`docs/neon_setup.md`](../neon_setup.md) — how to reproduce the setup.
