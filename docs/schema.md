# Database Schema

## Entities

### `users`
Authentication. `role` is one of `admin | hr | pm | employee`. Optional 1:1 link to `employees`.

### `employees`
Core profile. Self-referential `manager_id`. Denormalized `current_seat_id` and `current_project_id` for O(1) reads on the common "where does person X sit" query. `status` in `active | on_leave | exited`.

### `seats`
Physical desks. Unique `seat_code` like `B2-F3-Z1-S045`. `status` in `available | occupied | reserved | blocked`.

### `projects`
Business projects with a `code`, `name`, `client`, `pm_id`, `required_seats`, and lifecycle `status` (`active | on_hold | completed`).

### `project_assignments`
M2M join between employees and projects, with `role`, `allocation_pct` (0-100), `start_date`, and optional `end_date`.

### `seat_allocations`
Full history of who sat where. A row with `released_at IS NULL` is currently active. Composite indexes on `(seat_id, released_at)` and `(employee_id, released_at)` make active-lookup queries O(log n).

### `audit_log`
Append-only trail for mutations. `action` is a typed enum covering allocation events, project changes, and employee edits.

### `ai_query_log`
Every natural-language query, the SQL Gemini produced, row count, latency, and status. Used for both audit and prompt-tuning.

## Roles

- `neondb_owner` — primary application role. Full read/write.
- `ai_reader` — SELECT-only role used by the NL-to-SQL assistant (created in Phase 6 per [`neon_setup.md`](neon_setup.md)). No access to `users` or `audit_log`.

## Data at rest (after `python -m app.seed`)

| Table                 | Rows   |
| --------------------- | ------ |
| `users`               | 4      |
| `employees` (active)  | 5,000  |
| `employees` (exited)  | 300    |
| `seats`               | 6,000  |
| `projects`            | 30     |
| `project_assignments` | ~4,700 |
| `seat_allocations`    | ~4,800 |

Seat status distribution: **80% occupied / 15% available / 3% reserved / 2% blocked**.

## Migrations

- `382bc0c49159` — initial schema, all 8 tables and their indexes.

Managed by Alembic; see [`backend/alembic/versions/`](../backend/alembic/versions/).
