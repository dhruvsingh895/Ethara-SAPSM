# Architectural Decision Records

Short, dated records of the non-obvious architectural choices in this project. Written as they were made — not after the fact.

Each ADR follows a compact template:

- **Context** — what problem or forcing function?
- **Options** — what did we consider?
- **Decision** — what did we pick?
- **Consequences** — what did this cost us? What did we accept?

## Index

| ID | Title | Status |
| --- | --- | --- |
| [ADR-001](001-neon-over-supabase-and-render-postgres.md) | Neon over Supabase and Render Postgres | Accepted |
| [ADR-002](002-nl-to-sql-with-guardrails-over-tool-use.md) | NL-to-SQL with guardrails over LLM tool-use | Accepted |
| [ADR-003](003-single-neon-db-for-local-and-prod.md) | Single Neon DB for local dev and production | Accepted |
| [ADR-004](004-fk-cycle-with-use-alter-over-denormalization-purge.md) | FK cycle with `use_alter` over dropping the denormalized columns | Accepted |
| [ADR-005](005-recharts-with-custom-tooltip-content.md) | Recharts with a custom Tooltip content component | Accepted |
