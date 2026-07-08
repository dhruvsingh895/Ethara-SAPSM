# ADR-004: FK cycle with `use_alter` over dropping the denormalized columns

**Date:** 2026-07-08 · **Status:** Accepted

## Context

The domain has a mutual reference:

- `employees.current_project_id` → `projects.id` — "what project is this employee on right now?"
- `projects.pm_id` → `employees.id` — "who's the PM of this project?"

Alembic autogenerate flagged this as an unresolvable table sort — it can't decide whether to create `employees` or `projects` first, because each references the other.

## Options

1. **Drop `current_project_id` and `current_seat_id` from `employees`.** Look them up from `project_assignments` and `seat_allocations` on every read. Fully normalized. No FK cycle.
2. **Keep the denormalized columns.** Break the cycle at the DDL layer with `use_alter=True` — Alembic creates both tables first, then adds the FKs in a second pass.
3. **Keep the denormalized columns but drop the FK constraints on them.** Just use plain integer columns. Application code is responsible for referential integrity.

## Decision

**Option 2: keep the denormalized columns and use `use_alter=True` on the cycle edges.**

## Consequences

**Accepted:**

- Two `ALTER TABLE ADD CONSTRAINT` statements in the initial migration.
- Slight write cost — updating `current_seat_id` when a seat is allocated. This is atomic within the transaction in `services/allocation.py`.

**Gained:**

- `GET /employees/{id}` and the employee list return the current seat and project in a single query. No join to `seat_allocations` and filter by `released_at IS NULL`. This is the query the UI hits most often.
- Dashboard aggregates that filter by `current_project_id` or `current_seat_id` skip the join too.
- Referential integrity — if a project is deleted, the FK's `ON DELETE SET NULL` cleanly clears the `current_project_id` on affected employees. Option 3 would leave a dangling integer.

**Rejected explicitly:**

- **Option 1 (drop the columns)** — every seat map click, every employee detail page, and every dashboard aggregate would need a subquery or a window function. At 5,000 employees × 6,000 seats × 4,800 active allocations, that's a 10× slowdown on the hottest path in the app for zero real benefit — the seat allocation service already keeps `current_seat_id` in sync with `seat_allocations` atomically.
- **Option 3 (no FK)** — the whole point of Postgres is that referential integrity is a first-class citizen. Voluntarily giving that up because Alembic threw a warning is a bad trade.

## Related

- [`backend/app/models/employee.py`](../../backend/app/models/employee.py) — the `use_alter=True` on the FKs.
- [`backend/app/services/allocation.py`](../../backend/app/services/allocation.py) — the atomic multi-table write that keeps the denormalized state consistent.
