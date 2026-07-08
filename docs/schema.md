# Database Schema

_Detailed ERD, tables, columns, and indexes will be populated in Phase 1 once SQLAlchemy models are finalized._

## Entities

- `users` — auth (username, hashed password, role).
- `employees` — profile, status, current seat, current project.
- `seats` — building, floor, zone, status.
- `projects` — name, client, PM, status, required seats.
- `project_assignments` — join table with allocation %, role, dates.
- `seat_allocations` — history of allocations with `allocated_on` / `released_on`.
- `audit_log` — mutation trail.
- `ai_query_log` — NL query + generated SQL + result count.

## Roles

- `app_user` — main application role, full read/write on all tables.
- `ai_reader` — read-only role used by the NL-to-SQL assistant. No access to `users` or `password_hash`.
