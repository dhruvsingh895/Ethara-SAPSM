# Database Schema

## Entities

### `users`
Authentication. `role` is one of `admin | hr | pm | employee`. Optional 1:1 link to `employees`.

### `employees`
Core profile. Self-referential `manager_id`. Denormalized `current_seat_id` and `current_project_id` for O(1) reads on the common "where does person X sit" query. `status` in `active | on_leave | exited`.

The API response also carries the spec-aliased fields `name` (computed from `first_name + last_name`), `role` (aliased from `designation`), `employee_code` (aliased from `emp_code`), and `project_id` (aliased from `current_project_id`) so the shape matches assessment §7 without a schema rewrite.

### `seats`
Physical desks. Unique `seat_code` like `B2-F3-ZE-S045`. Columns: `building`, `floor`, `zone`, `bay`, `seat_number`, `status`.

- `status` ∈ `available | occupied | reserved | maintenance` (spec §3.3).
- 10 distinct zone codes across the estate: `ZA..ZE` in B1, `ZF..ZJ` in B2 (exactly meets spec §6 ≥10 zones).
- `bay` groups seats within a zone into physical clusters (`BAY-1..BAY-4`).
- Unique composite index on `(building, floor, zone, seat_number)` enforces spec §8.7: no duplicate seat number on the same floor/zone.
- API responses (`SeatOut`) also embed the current active allocation as `allocated_employee_id`, `allocated_project_id`, and `allocation_date` (spec §3.3), sourced from the join with `seat_allocations`.

### `projects`
Business projects with a `code`, `name`, `client`, `pm_id`, `required_seats`, and lifecycle `status` (`active | on_hold | completed`).

Seed data uses the 11 exact project names named in spec §3.2 (Indigo, Indreed, Mydreed, Preed, Serfy, Oreed, bedegreed, Opreed, Serry, Kaary, Mered) for `PRJ001..PRJ011`, then generated names to pad up to the seed target.

Spec §7 names the project-manager column `manager_name` (a string). Ours is `pm_id` — a nullable FK into `employees(id)` — so the manager stays consistent when an employee is renamed, and joins are cheap. The API's `ProjectOut` exposes `pm_id`; the frontend fetches the employee row to render the name.

### `project_assignments`
Join between employees and projects, with `role`, `allocation_pct` (0-100, currently always 100), `start_date`, and optional `end_date`.

Spec §3.2 requires each employee to be mapped to **one active project at a time**. Enforced with a partial unique index — `uq_pa_active_employee` on `(employee_id) WHERE end_date IS NULL`. Historical rows (with `end_date` set) are unrestricted so a full assignment history is preserved. The `POST /projects/{id}/assignments` endpoint rejects any second concurrent assignment with a 409 before hitting the index.

### `seat_allocations`
Full history of who sat where. A row with `released_at IS NULL` is currently active. Composite indexes on `(seat_id, released_at)` and `(employee_id, released_at)` make active-lookup queries O(log n).

Spec §7 also lists a `project_id` on `seat_allocations`. We chose not to denormalise the project onto the allocation because an employee's project can change *during* an active seat allocation — storing it here would go stale. Instead the current project is read from `employees.current_project_id` at query time, and the historical project (at the moment the allocation was made) is recoverable from the audit log.

### `audit_log`
Append-only trail for mutations. `action` is a typed enum covering allocation events, project changes, and employee edits. Includes `maintenance` (renamed from `block` in migration `a2f4c81b5e07` to match spec vocabulary).

### `ai_query_log`
Every natural-language query, the SQL Gemini produced, row count, latency, and status. Used for both audit and prompt-tuning.

### `departments`
Canonical department list — used by every dropdown in the app. Renamed rows cascade to `employees.department` in a single transaction.

## Roles

- `neondb_owner` — primary application role. Full read/write.
- `ai_reader` — SELECT-only role used by the NL-to-SQL assistant (created in Phase 6 per [`neon_setup.md`](neon_setup.md)). No access to `users` or `audit_log`.

## Data at rest (after `python -m app.seed`)

| Table                 | Rows    | Spec minimum |
| --------------------- | ------- | ------------ |
| `users`               | 4       | —            |
| `employees` (active)  | 5,000   | ≥ 5,000      |
| `employees` (exited)  | 300     | —            |
| `seats`               | 5,500   | ≥ 5,500      |
| `seats` available     | 825     | ≥ 500        |
| `seats` reserved      | 165     | ≥ 100        |
| Unallocated actives   | 600     | ≥ 50         |
| `projects`            | 30      | ≥ 10 (11 spec-named + 19 generated) |
| `distinct zones`      | 10      | ≥ 10         |
| `project_assignments` | ~4,470  | —            |
| `seat_allocations`    | 4,400   | —            |

Seat status distribution: **80% occupied / 15% available / 3% reserved / 2% maintenance**.

The seed script logs a `SPEC MINIMUM MISSED` warning at the end of every full-scale run if any minimum falls below the spec, so bad configuration surfaces immediately.

## Business rules (enforced)

Per spec §8:

1. **One employee ↔ one active seat.** Enforced in the allocation service (`services/allocation.py`) — cannot allocate if `employees.current_seat_id IS NOT NULL`.
2. **One seat ↔ one active employee.** Enforced by refusing allocation on a non-`available` seat.
3. **Released seats become available.** `release()` sets `seats.status = available` in the same transaction as the allocation update.
4. **Reserved seats cannot be allocated.** `allocate()` rejects with 409 unless status is first changed via `PUT /seats/{id}`.
5. **New-joiner proximity.** `services/new_joiner.py` ranks vacant seats by teammate density, packing scarce zones first.
6. **Unique employee email.** `employees.email` has a unique index; POST/PUT rejects duplicates with 409.
7. **Unique seat per floor/zone.** Composite unique index on `(building, floor, zone, seat_number)`.
8. **Dashboard freshness.** No caching — every dashboard query hits the DB directly. Denormalized fields on `employees` keep the hot paths O(1).

Plus one non-numbered rule from spec §3.2:

9. **One active project per employee.** Partial unique index on `project_assignments (employee_id) WHERE end_date IS NULL` + endpoint-level 409 guard. Historical rows unaffected.

## Migrations

- `382bc0c49159` — initial schema, all 8 tables and their indexes.
- `ce61f5725b04` — add `departments` table.
- `a2f4c81b5e07` — add `seats.bay` column, rename `blocked` → `maintenance` in `seats.status` and `audit_log.action`, add composite unique on `(building, floor, zone, seat_number)`.
- `c7d3e2a91f10` — enforce spec §3.2: partial unique index on `project_assignments (employee_id) WHERE end_date IS NULL` so an employee has at most one active assignment.

Managed by Alembic; see [`backend/alembic/versions/`](../backend/alembic/versions/).
