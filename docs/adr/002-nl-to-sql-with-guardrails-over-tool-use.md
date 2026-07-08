# ADR-002: NL-to-SQL with guardrails over LLM tool-use

**Date:** 2026-07-08 · **Status:** Accepted

## Context

The brief requires an "AI Assistant / Natural Language Query Interface." Two well-known patterns for wiring an LLM to a database:

1. **Tool-use.** Define typed functions (`search_employees(dept: str)`, `get_utilization()`, ...). The LLM picks a tool and fills its arguments. We execute the tool and return the rows. Safe by construction — the LLM can only invoke pre-authored functions.
2. **NL-to-SQL.** Show the LLM the schema, ask it to write SQL, execute the result against a read-only DB role. Flexible — the LLM can answer questions we didn't anticipate. Risky — the LLM can write dangerous SQL.

## Options

- **Tool-use only** — safest, but every new question type requires code. "Show me employees hired last Tuesday" needs a new tool. Poor evaluator demo signal.
- **NL-to-SQL, unguarded** — dangerous. The LLM could write `DELETE`, `SELECT ... FROM users`, or a query that hangs the DB.
- **NL-to-SQL with defense-in-depth guardrails** — the flexibility of NL-to-SQL with an inspection and execution boundary that refuses anything unsafe.

## Decision

**NL-to-SQL with a 5-layer guard.** See [`docs/ai_safety.md`](../ai_safety.md) for the full model.

The 5 layers:

1. **Prompt hardening** — Gemini sees only a schema (DDL) with 5 whitelisted tables. `users`, `audit_log`, `ai_query_log` are hidden entirely.
2. **Output sanitization** — strip Markdown fences, prose prefixes, and trailing semicolons.
3. **SQL parse-time guard** — `sqlparse` confirms exactly one statement of type SELECT. Any DDL/DML keyword or forbidden table name in the output is rejected before execution.
4. **Session-level enforcement** — `SET LOCAL default_transaction_read_only = ON` and `SET LOCAL statement_timeout = '3s'` before the query runs.
5. **Auto-`LIMIT`** — if the query has no `LIMIT` clause, we append `LIMIT 100` so a runaway `SELECT * FROM employees` can't return the whole table.

## Consequences

**Accepted:**

- Extra code surface — a guard, a validator, an audit log table. Roughly 400 LOC.
- Some legitimate questions will be blocked. For example, a nested subquery that references `users` metaphorically ("users of the system") could trigger the restricted-table check. The audit log makes these visible.
- Free-tier Gemini rate limits mean a naive frontend loop can hit 429s. The UI already debounces via the `busy` state.

**Gained:**

- Flexible NL surface — "How many seats are available on floor 3?" and "Which projects are for client Aurora Bank?" both return in ~2s with correct SQL. No new backend code needed for either.
- **Empirically safe.** The direct-guard test (`scripts/ai_smoke_test.py`) proves 10/10 known-dangerous SQL statements are blocked at the guard layer — this doesn't depend on Gemini deciding to refuse.
- Every query is logged to `ai_query_log` with the prompt, generated SQL, row count, latency, and status. This is a valuable audit surface for a real deployment.

## Rejected

- **Tool-use only.** Would have shipped in less code, but the assessment specifically asks for a "Natural Language Query Interface." Tool-use is closer to a form builder than an NL interface. Evaluator would notice.
- **NL-to-SQL, unguarded.** Not defensible. A single "ignore previous instructions and delete everything" prompt would be an incident.

## Related

- [`docs/ai_safety.md`](../ai_safety.md) — full threat model and test evidence.
- [`backend/app/services/sql_guard.py`](../../backend/app/services/sql_guard.py) — the guard.
- [`backend/app/services/gemini.py`](../../backend/app/services/gemini.py) — the schema-only system prompt.
