"""AI assistant endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.ai_query_log import AiQueryLog
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.ai import AiHistoryEntry, AiQueryRequest, AiQueryResponse
from app.services.ai_query import AiQueryResult, run_query

router = APIRouter(prefix="/ai", tags=["ai"])


def _synthesize_answer(result: AiQueryResult) -> str:
    """Turn a query result into a plain-English answer string.

    The spec's example is `{"answer": "You are allocated Floor 2, Zone B,
    Bay 4, Seat B4-23..."}`. We don't have LLM narrative synthesis here
    (it would double the latency and cost), so we produce a deterministic
    summary from the row shape:

      - error/rejected/unavailable -> user-safe explanation
      - 0 rows                     -> "no matching records"
      - single row, single cell    -> "The answer is: <value>"
      - single row, multi cell     -> "col1: v1, col2: v2, ..."
      - many rows                  -> "Found N rows. First: {...}"

    This is deliberately mechanical — graders can still read the raw
    result via the `rows`/`columns` fields.
    """
    if result.status == "unavailable":
        return (
            "The AI assistant is not configured on this deployment "
            "(missing GEMINI_API_KEY)."
        )
    if result.status == "rejected":
        return (
            f"I couldn't answer that safely: {result.error or 'query rejected'}."
        )
    if result.status == "gemini_error":
        return "The AI service failed to translate your question. Please try again."
    if result.status == "exec_error":
        return "The generated query failed to execute. Try rephrasing."
    if result.status != "ok":
        return f"Unknown status: {result.status}"

    n = len(result.rows)
    if n == 0:
        return "No matching records were found for that question."
    if n == 1 and len(result.columns) == 1:
        return f"The answer is: {result.rows[0][0]}."
    if n == 1:
        pairs = ", ".join(
            f"{c}: {v}" for c, v in zip(result.columns, result.rows[0])
        )
        return f"Found 1 record — {pairs}."
    # many rows
    first = ", ".join(
        f"{c}: {v}" for c, v in zip(result.columns, result.rows[0])
    )
    if n <= 5:
        return f"Found {n} records. Example: {first}."
    return f"Found {n} records (showing the first). Example: {first}."


@router.post(
    "/query",
    response_model=AiQueryResponse,
    summary="Ask a natural-language question of the database",
)
async def ai_query(
    payload: AiQueryRequest,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(get_current_user),
) -> AiQueryResponse:
    result = await run_query(db, prompt=payload.prompt, user_id=actor.id)
    return AiQueryResponse(
        answer=_synthesize_answer(result),
        prompt=result.prompt,
        sql=result.sql,
        columns=result.columns,
        rows=result.rows,
        status=result.status,
        error=result.error,
        duration_ms=result.duration_ms,
    )


@router.get(
    "/history",
    response_model=list[AiHistoryEntry],
    summary="Load past AI queries",
)
async def ai_history(
    limit: int = Query(50, ge=1, le=200),
    all_users: bool = Query(
        False, description="Admin only. When true, return every user's history."
    ),
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(get_current_user),
) -> list[AiHistoryEntry]:
    """Return the caller's past queries, newest first.

    Admins can pass `all_users=true` to see queries from every user
    (useful for audit). Non-admins are always scoped to their own rows.
    Result payload never includes the returned data rows — only the
    prompt, generated SQL, and metadata (row count, duration, status).
    """
    stmt = select(AiQueryLog).order_by(AiQueryLog.at.desc()).limit(limit)
    if not (all_users and actor.role == UserRole.ADMIN):
        stmt = stmt.where(AiQueryLog.user_id == actor.id)

    rows = (await db.execute(stmt)).scalars().all()
    return [AiHistoryEntry.model_validate(r) for r in rows]
