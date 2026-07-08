"""SQL guardrails for the NL-to-SQL assistant.

Defense-in-depth against Gemini producing unsafe SQL:

1. Strip markdown code fences and stray commentary.
2. Ensure exactly one statement.
3. Statement type must be SELECT.
4. Reject any occurrence of forbidden keywords or sensitive tables
   (belt-and-braces even if the parse thinks it's a SELECT — protects
   against comment tricks, encoded chars, or parser edge cases).
5. Auto-inject LIMIT if the query has none.

The caller executes the returned SQL against a session that is already
in read-only mode with a statement_timeout.
"""

from __future__ import annotations

import re

import sqlparse
from sqlparse.sql import Statement
from sqlparse.tokens import DML, Keyword

# Keywords that must never appear (even in comments — we strip those first).
FORBIDDEN_KEYWORDS = {
    "INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "TRUNCATE",
    "GRANT", "REVOKE", "CREATE", "COPY", "MERGE", "CALL", "EXECUTE",
    "VACUUM", "REINDEX", "LOCK", "SET",
}

# Tables the assistant is not allowed to see.
FORBIDDEN_TABLES = {"users", "audit_log", "ai_query_log"}

_FENCE_RE = re.compile(r"^```(?:sql)?\s*|\s*```$", re.IGNORECASE | re.MULTILINE)
_COMMENT_RE = re.compile(r"--[^\n]*|/\*.*?\*/", re.DOTALL)
_TRAILING_SEMI_RE = re.compile(r";\s*$")


class UnsafeSQLError(ValueError):
    """Raised when generated SQL fails a guardrail check."""


def _strip_fences(text: str) -> str:
    """Remove Markdown code fences that Gemini often adds."""
    return _FENCE_RE.sub("", text).strip()


def _strip_comments(sql: str) -> str:
    return _COMMENT_RE.sub(" ", sql)


def _tokens_upper(sql: str) -> set[str]:
    """Return the set of uppercase word tokens present, for fast checking."""
    return set(re.findall(r"[A-Za-z_]+", sql.upper()))


def sanitize_and_validate(generated: str) -> str:
    """Return a safe SELECT statement or raise UnsafeSQLError.

    - Strips fences and any prose Gemini added.
    - Ensures exactly one statement.
    - Confirms the statement is a SELECT.
    - Blocks forbidden keywords and sensitive tables.
    - Injects LIMIT 100 when missing.
    """
    raw = _strip_fences(generated or "")
    if not raw:
        raise UnsafeSQLError("Empty query")

    # Remove a leading conversational prefix like "Here is the SQL:" if any.
    lines = raw.splitlines()
    for i, line in enumerate(lines):
        if line.strip().upper().startswith(("SELECT", "WITH")):
            raw = "\n".join(lines[i:]).strip()
            break

    # Drop trailing semicolons.
    raw = _TRAILING_SEMI_RE.sub("", raw).strip()

    if not raw:
        raise UnsafeSQLError("No SQL statement found in model output")

    # sqlparse split — reject multi-statement.
    statements = [s for s in sqlparse.parse(raw) if str(s).strip()]
    if len(statements) != 1:
        raise UnsafeSQLError("Expected exactly one SQL statement")

    stmt: Statement = statements[0]
    stmt_type = stmt.get_type()
    if stmt_type != "SELECT":
        raise UnsafeSQLError(
            f"Only SELECT statements are allowed (got {stmt_type})"
        )

    # Look at tokens post-comment-strip for forbidden keywords.
    cleaned = _strip_comments(raw)
    words = _tokens_upper(cleaned)

    hit = FORBIDDEN_KEYWORDS & words
    if hit:
        raise UnsafeSQLError(
            f"Query contains forbidden keywords: {sorted(hit)}"
        )

    hit_tbl = FORBIDDEN_TABLES & {w.lower() for w in words}
    if hit_tbl:
        raise UnsafeSQLError(
            f"Query references restricted tables: {sorted(hit_tbl)}"
        )

    # Additional check: at least one recognized SELECT/DML token in the
    # parsed statement (defense against parser oddities).
    if not any(t.ttype is DML and t.normalized.upper() == "SELECT" for t in stmt.flatten()):
        # Might be a CTE — accept if WITH ... SELECT.
        if not any(
            t.ttype is Keyword.CTE or t.normalized.upper() == "WITH"
            for t in stmt.flatten()
        ):
            raise UnsafeSQLError("Statement is not a SELECT")

    # Inject LIMIT if missing (case-insensitive scan of the top level).
    if "LIMIT" not in words:
        raw = raw.rstrip() + " LIMIT 100"

    return raw
