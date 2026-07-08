# ADR-003: Single Neon DB for local dev and production

**Date:** 2026-07-08 · **Status:** Accepted

## Context

At the start of Phase 1 we had three ways to structure the data plane:

1. Local Docker Postgres for dev, separate Neon project for prod.
2. Neon "dev" branch for local, "main" branch for prod.
3. One Neon database shared between local and prod.

## Decision

**Option 3: one shared Neon database.** All migrations run against Neon directly from the developer's machine.

## Consequences

**Accepted risk:** local mistakes affect production data. Specifically:

- A bad migration would land in prod.
- `python -m app.seed --wipe` would truncate the seeded rows in prod. The seed script is idempotent and the `--wipe` flag is required and destructive — the safety comes from the user typing it deliberately.
- Any developer with the `.env` file has full production access. In a real team this would be unacceptable; for a single-developer assessment it's a controlled tradeoff.

**Gained:**

- Zero setup friction. No Docker Desktop, no branch management, no environment sync.
- Migrations tested against the exact DB engine (Neon's Postgres 18 fork) they'll run against.
- Load tests, `EXPLAIN ANALYZE`, and the AI assistant all produce numbers that translate directly to production behavior.

## Mitigations we did add

- All migrations have explicit `downgrade()` functions written by hand — not blank pass statements.
- The seed refuses to run without `--wipe` if the `employees` table is non-empty. You can't accidentally re-seed.
- Every mutation writes an `audit_log` row, so any local write is traceable after the fact.
- Pre-deployment checklist in [`docs/deployment.md`](../deployment.md) requires rotating all Neon credentials before submission.

## When we'd change our mind

For any real team, or a project expected to live past the assessment, we'd flip to **option 2 (Neon branching)**. It's free, it uses Neon's copy-on-write branch feature (no extra storage cost), and it eliminates the accidental-write footgun without any Docker overhead.
