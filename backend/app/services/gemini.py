"""Thin wrapper around Google's Gemini API for NL-to-SQL.

Schema is hand-authored (not autogen'd) so the model gets exactly the
tables it's allowed to query. Sensitive tables (users, audit_log,
ai_query_log) are deliberately omitted from the prompt.
"""

from __future__ import annotations

import logging
from typing import Optional

import google.generativeai as genai

from app.core.config import get_settings

log = logging.getLogger("gemini")

# Schema shown to Gemini. Kept short and semantic — no comments about
# the sensitive tables and no PII columns.
SCHEMA_DDL = """
-- Available tables (Postgres 16 dialect):

CREATE TABLE employees (
    id            SERIAL PRIMARY KEY,
    emp_code      VARCHAR(16) UNIQUE,        -- e.g. 'E00042' (uppercase E + 5 digits)
    first_name    VARCHAR(64),               -- Title Case, e.g. 'Amit'
    last_name     VARCHAR(64),               -- Title Case, e.g. 'Kumar'
    email         VARCHAR(255),              -- lowercase, e.g. 'e00042@ethara.dev'
    designation   VARCHAR(80),               -- free-form Title Case, e.g. 'SDE 2', 'Engineering Manager'
    department    VARCHAR(64),               -- Title Case exact match: 'Engineering', 'Product', 'Design', 'QA', 'Data', 'Sales', 'Ops', 'HR', 'Finance'
    joining_date  DATE,
    exit_date     DATE,                      -- NULL for active/on-leave employees
    status        VARCHAR(32),               -- UPPERCASE: 'ACTIVE' | 'ON_LEAVE' | 'EXITED'
    manager_id    INT REFERENCES employees(id),
    current_seat_id     INT REFERENCES seats(id),   -- NULL when the employee has no seat
    current_project_id  INT REFERENCES projects(id) -- NULL when unassigned
);

CREATE TABLE seats (
    id           SERIAL PRIMARY KEY,
    seat_code    VARCHAR(32) UNIQUE,         -- e.g. 'B2-F3-ZE-S045'
    building     VARCHAR(16),                -- 'B1' | 'B2' | 'B3'
    floor        INT,                        -- 1..5
    zone         VARCHAR(16),                -- 'ZA'..'ZL' (4 per building × 3 buildings = 12 total, uppercase)
    bay          VARCHAR(16),                -- 'BAY-1'..'BAY-4' cluster within a zone
    seat_number  INT,
    status       VARCHAR(32)                 -- UPPERCASE: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'MAINTENANCE'
);

CREATE TABLE projects (
    id             SERIAL PRIMARY KEY,
    code           VARCHAR(16) UNIQUE,       -- e.g. 'PRJ001' (uppercase PRJ + 3 digits)
    name           VARCHAR(120),             -- Title Case, e.g. 'Indigo', 'Falcon Migration 02'
    client         VARCHAR(120),             -- Title Case, e.g. 'Aurora Bank', 'Ethara Internal'
    status         VARCHAR(32),              -- UPPERCASE: 'ACTIVE' | 'ON_HOLD' | 'COMPLETED'
    start_date     DATE,
    end_date       DATE,                     -- NULL means still running
    required_seats INT,
    pm_id          INT REFERENCES employees(id)
);

CREATE TABLE project_assignments (
    id             SERIAL PRIMARY KEY,
    employee_id    INT REFERENCES employees(id),
    project_id     INT REFERENCES projects(id),
    role           VARCHAR(80),              -- Title Case: 'Developer' | 'Lead' | 'Analyst' | 'Designer' | 'Reviewer' | 'SDET'
    allocation_pct INT,                      -- 0-100
    start_date     DATE,
    end_date       DATE                      -- NULL means currently active
);

CREATE TABLE seat_allocations (
    id             SERIAL PRIMARY KEY,
    seat_id        INT REFERENCES seats(id),
    employee_id    INT REFERENCES employees(id),
    allocated_at   TIMESTAMPTZ,
    released_at    TIMESTAMPTZ               -- NULL means currently active
);
"""

_SYSTEM_PROMPT = """You are a read-only SQL analyst for the Ethara SAPSM (Seat Allocation & Project Mapping System) Postgres database.

Rules:
1. Return a SINGLE valid Postgres SELECT statement.
2. Do NOT use INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, GRANT, REVOKE, CREATE, COPY, MERGE, CALL, EXECUTE, VACUUM, or any DDL/DML.
3. Do NOT reference tables named `users`, `audit_log`, or `ai_query_log` — they are restricted.
4. Prefer aggregate queries when the question asks for counts/totals.
5. Include a LIMIT clause of 100 or fewer for row-returning queries.
6. Case-sensitivity is CRITICAL. The DB is case-sensitive on equality comparisons.
   - Enum-backed columns (employees.status, seats.status, projects.status) are stored UPPERCASE. Use 'ACTIVE', 'OCCUPIED', 'AVAILABLE', etc. Never 'active', 'occupied'.
   - Free-text columns (department, first_name, client, project name, assignment role) are stored Title Case: 'Engineering', 'Aurora Bank', 'Developer'.
   - When you are matching a user-typed value against any free-text column, ALWAYS use ILIKE with wildcards: `department ILIKE '%engineer%'`. Never use plain `=` on user-typed text.
   - When counting or filtering by enum status, use the exact UPPERCASE spelling — no ILIKE needed.
7. Handle NULLs explicitly:
   - `current_seat_id IS NULL` means the employee has no seat.
   - `current_project_id IS NULL` means the employee is unassigned.
   - `end_date IS NULL` on project_assignments or seat_allocations means the row is currently active.
   - `exit_date IS NULL` on employees means they haven't left.
8. "Available seats", "free seats", "empty seats" all mean `seats.status = 'AVAILABLE'`.
   "Blocked" / "maintenance" / "out of service" all mean `seats.status = 'MAINTENANCE'`.
   "Occupied" / "taken" / "used" means `seats.status = 'OCCUPIED'`.
9. To count active project members, join `project_assignments` with `end_date IS NULL OR end_date >= CURRENT_DATE`.
10. Return ONLY the SQL — no explanations, no prose, no markdown, no code fences.

Schema:
""" + SCHEMA_DDL


class GeminiNotConfigured(RuntimeError):
    pass


# Cache for the currently-configured (key_index, model). We rebuild
# the model whenever we rotate to a different key because
# `genai.configure()` is process-global — the model captures the key
# via SDK-internal state at construction time.
_ACTIVE_KEY_INDEX = 0
_MODEL = None


def _mask(key: str) -> str:
    if not key:
        return "<empty>"
    if len(key) <= 8:
        return key[:2] + "***"
    return f"{key[:4]}...{key[-4:]}"


def _build_model(key: str):
    settings = get_settings()
    genai.configure(api_key=key)
    m = genai.GenerativeModel(
        settings.gemini_model,
        system_instruction=_SYSTEM_PROMPT,
    )
    log.info("gemini configured model=%s key=%s", settings.gemini_model, _mask(key))
    return m


def _get_model():
    global _MODEL, _ACTIVE_KEY_INDEX
    if _MODEL is not None:
        return _MODEL
    settings = get_settings()
    keys = settings.gemini_api_keys_list
    if not keys:
        raise GeminiNotConfigured("GEMINI_API_KEY is not set")
    _ACTIVE_KEY_INDEX = 0
    _MODEL = _build_model(keys[0])
    return _MODEL


def _rotate_to_next_key() -> Optional["genai.GenerativeModel"]:
    """Move to the next key in the list. Returns the new model, or None
    if we've exhausted the list. Failure of a key doesn't remove it —
    on the next process restart we start over from index 0.
    """
    global _MODEL, _ACTIVE_KEY_INDEX
    settings = get_settings()
    keys = settings.gemini_api_keys_list
    if _ACTIVE_KEY_INDEX + 1 >= len(keys):
        return None
    _ACTIVE_KEY_INDEX += 1
    next_key = keys[_ACTIVE_KEY_INDEX]
    log.warning(
        "gemini key rotation: index %d -> %d (%s)",
        _ACTIVE_KEY_INDEX - 1, _ACTIVE_KEY_INDEX, _mask(next_key),
    )
    _MODEL = _build_model(next_key)
    return _MODEL


async def generate_sql(nl_query: str) -> str:
    """Ask Gemini for a SQL translation of the natural-language query.

    Iterates the configured GEMINI_API_KEY list. On any exception from
    the SDK (rate-limit, auth, network), the next key is tried. Raises
    the LAST error if every key fails.
    """
    import anyio

    text_prompt = nl_query.strip()
    model = _get_model()
    settings = get_settings()
    total_keys = len(settings.gemini_api_keys_list)
    attempts = 0
    last_exc: Optional[Exception] = None

    while attempts < max(1, total_keys):
        try:
            resp = await anyio.to_thread.run_sync(
                lambda m=model: m.generate_content(text_prompt)
            )
            return (resp.text or "").strip()
        except Exception as e:
            last_exc = e
            log.warning(
                "gemini call failed on key index %d (%s): %s",
                _ACTIVE_KEY_INDEX,
                _mask(settings.gemini_api_keys_list[_ACTIVE_KEY_INDEX])
                if total_keys else "<none>",
                str(e)[:200],
            )
            next_model = _rotate_to_next_key()
            if next_model is None:
                break
            model = next_model
            attempts += 1

    assert last_exc is not None
    raise last_exc


def usage_from_response(resp) -> Optional[dict]:  # kept for future observability
    meta = getattr(resp, "usage_metadata", None)
    if meta is None:
        return None
    return {
        "prompt_tokens": meta.prompt_token_count,
        "output_tokens": meta.candidates_token_count,
        "total_tokens": meta.total_token_count,
    }
