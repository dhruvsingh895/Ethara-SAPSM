"""Orchestrator: NL prompt -> Gemini -> guard -> execute (read-only) -> log."""

from __future__ import annotations

import time
from typing import Any, Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ai_query_log import AiQueryLog
from app.services import gemini
from app.services.sql_guard import UnsafeSQLError, sanitize_and_validate


class AiQueryResult:
    def __init__(
        self,
        *,
        prompt: str,
        sql: Optional[str],
        columns: list[str],
        rows: list[list[Any]],
        status: str,
        error: Optional[str],
        duration_ms: int,
    ):
        self.prompt = prompt
        self.sql = sql
        self.columns = columns
        self.rows = rows
        self.status = status
        self.error = error
        self.duration_ms = duration_ms


async def _log(
    db: AsyncSession,
    *,
    user_id: Optional[int],
    prompt: str,
    sql: Optional[str],
    rows: Optional[int],
    duration_ms: int,
    status: str,
    error: Optional[str],
) -> None:
    db.add(
        AiQueryLog(
            user_id=user_id,
            prompt=prompt,
            generated_sql=sql,
            rows_returned=rows,
            duration_ms=duration_ms,
            status=status,
            error=error,
        )
    )
    await db.commit()


async def run_query(
    db: AsyncSession,
    *,
    prompt: str,
    user_id: Optional[int] = None,
) -> AiQueryResult:
    """End-to-end NL-to-SQL pipeline. Always logs to ai_query_log."""
    prompt = prompt.strip()
    t0 = time.perf_counter()

    if not prompt:
        result = AiQueryResult(
            prompt=prompt, sql=None, columns=[], rows=[],
            status="rejected", error="Empty prompt", duration_ms=0,
        )
        await _log(
            db, user_id=user_id, prompt=prompt, sql=None, rows=None,
            duration_ms=0, status=result.status, error=result.error,
        )
        return result

    # 1. Generate SQL.
    try:
        raw_sql = await gemini.generate_sql(prompt)
    except gemini.GeminiNotConfigured as e:
        duration_ms = int((time.perf_counter() - t0) * 1000)
        await _log(
            db, user_id=user_id, prompt=prompt, sql=None, rows=None,
            duration_ms=duration_ms, status="unavailable", error=str(e),
        )
        return AiQueryResult(
            prompt=prompt, sql=None, columns=[], rows=[],
            status="unavailable", error=str(e), duration_ms=duration_ms,
        )
    except Exception as e:  # network / quota / etc
        duration_ms = int((time.perf_counter() - t0) * 1000)
        await _log(
            db, user_id=user_id, prompt=prompt, sql=None, rows=None,
            duration_ms=duration_ms, status="gemini_error", error=str(e)[:500],
        )
        return AiQueryResult(
            prompt=prompt, sql=None, columns=[], rows=[],
            status="gemini_error", error=str(e)[:500], duration_ms=duration_ms,
        )

    # 2. Guard.
    try:
        safe_sql = sanitize_and_validate(raw_sql)
    except UnsafeSQLError as e:
        duration_ms = int((time.perf_counter() - t0) * 1000)
        await _log(
            db, user_id=user_id, prompt=prompt, sql=raw_sql, rows=None,
            duration_ms=duration_ms, status="rejected", error=str(e),
        )
        return AiQueryResult(
            prompt=prompt, sql=raw_sql, columns=[], rows=[],
            status="rejected", error=str(e), duration_ms=duration_ms,
        )

    # 3. Execute in a read-only session with a statement timeout.
    try:
        # New nested transaction so our session-level settings don't leak.
        await db.execute(text("SET LOCAL statement_timeout = '3s'"))
        await db.execute(text("SET LOCAL default_transaction_read_only = ON"))
        result = await db.execute(text(safe_sql))
        columns = list(result.keys())
        raw_rows = result.fetchall()
        # Convert to JSON-safe list-of-lists.
        rows: list[list[Any]] = []
        for r in raw_rows:
            rows.append([_json_safe(v) for v in r])
    except Exception as e:  # execution error
        await db.rollback()
        duration_ms = int((time.perf_counter() - t0) * 1000)
        await _log(
            db, user_id=user_id, prompt=prompt, sql=safe_sql, rows=None,
            duration_ms=duration_ms, status="exec_error", error=str(e)[:500],
        )
        return AiQueryResult(
            prompt=prompt, sql=safe_sql, columns=[], rows=[],
            status="exec_error", error=str(e)[:500], duration_ms=duration_ms,
        )
    finally:
        # rollback releases the SET LOCAL scope cleanly even on success
        # since we don't need to persist reads.
        try:
            await db.rollback()
        except Exception:
            pass

    duration_ms = int((time.perf_counter() - t0) * 1000)
    await _log(
        db, user_id=user_id, prompt=prompt, sql=safe_sql, rows=len(rows),
        duration_ms=duration_ms, status="ok", error=None,
    )
    return AiQueryResult(
        prompt=prompt, sql=safe_sql, columns=columns, rows=rows,
        status="ok", error=None, duration_ms=duration_ms,
    )


def _json_safe(v: Any) -> Any:
    """Coerce values that JSON can't serialize by default."""
    from datetime import date, datetime
    from decimal import Decimal
    if isinstance(v, (datetime, date)):
        return v.isoformat()
    if isinstance(v, Decimal):
        return float(v)
    return v
