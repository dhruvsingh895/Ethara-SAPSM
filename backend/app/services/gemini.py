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
    emp_code      VARCHAR(16) UNIQUE,        -- e.g. E00042
    first_name    VARCHAR(64),
    last_name     VARCHAR(64),
    email         VARCHAR(255),
    designation   VARCHAR(80),
    department    VARCHAR(64),               -- Engineering, Product, Design, QA, Data, Sales, Ops, HR, Finance
    joining_date  DATE,
    exit_date     DATE,
    status        VARCHAR(32),               -- 'ACTIVE' | 'ON_LEAVE' | 'EXITED'
    manager_id    INT REFERENCES employees(id),
    current_seat_id     INT REFERENCES seats(id),
    current_project_id  INT REFERENCES projects(id)
);

CREATE TABLE seats (
    id           SERIAL PRIMARY KEY,
    seat_code    VARCHAR(32) UNIQUE,         -- e.g. B2-F3-Z1-S045
    building     VARCHAR(16),                -- 'B1' | 'B2' | 'B3'
    floor        INT,                        -- 1..5
    zone         VARCHAR(16),                -- 'Z1' | 'Z2' | 'Z3' | 'Z4'
    seat_number  INT,
    status       VARCHAR(32)                 -- 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'BLOCKED'
);

CREATE TABLE projects (
    id             SERIAL PRIMARY KEY,
    code           VARCHAR(16) UNIQUE,       -- e.g. PRJ001
    name           VARCHAR(120),
    client         VARCHAR(120),
    status         VARCHAR(32),              -- 'ACTIVE' | 'ON_HOLD' | 'COMPLETED'
    start_date     DATE,
    end_date       DATE,
    required_seats INT,
    pm_id          INT REFERENCES employees(id)
);

CREATE TABLE project_assignments (
    id             SERIAL PRIMARY KEY,
    employee_id    INT REFERENCES employees(id),
    project_id     INT REFERENCES projects(id),
    role           VARCHAR(80),
    allocation_pct INT,                      -- 0-100
    start_date     DATE,
    end_date       DATE                      -- NULL means still active
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
6. Use ILIKE for case-insensitive text search on names, emails, or codes.
7. Refer to enum values in the case shown in the schema (ACTIVE, AVAILABLE, etc).
8. Return ONLY the SQL — no explanations, no prose, no markdown.

Schema:
""" + SCHEMA_DDL


class GeminiNotConfigured(RuntimeError):
    pass


_MODEL = None


def _get_model():
    global _MODEL
    if _MODEL is not None:
        return _MODEL
    settings = get_settings()
    if not settings.gemini_api_key:
        raise GeminiNotConfigured("GEMINI_API_KEY is not set")
    genai.configure(api_key=settings.gemini_api_key)
    _MODEL = genai.GenerativeModel(
        settings.gemini_model,
        system_instruction=_SYSTEM_PROMPT,
    )
    log.info("gemini configured model=%s", settings.gemini_model)
    return _MODEL


async def generate_sql(nl_query: str) -> str:
    """Ask Gemini for a SQL translation of the natural-language query."""
    model = _get_model()
    # Gemini SDK's generate_content is sync; wrap for consistency with the
    # async endpoint (network I/O bound, so a thread is acceptable here).
    import anyio
    resp = await anyio.to_thread.run_sync(
        lambda: model.generate_content(nl_query.strip())
    )
    text = resp.text or ""
    return text.strip()


def usage_from_response(resp) -> Optional[dict]:  # kept for future observability
    meta = getattr(resp, "usage_metadata", None)
    if meta is None:
        return None
    return {
        "prompt_tokens": meta.prompt_token_count,
        "output_tokens": meta.candidates_token_count,
        "total_tokens": meta.total_token_count,
    }
