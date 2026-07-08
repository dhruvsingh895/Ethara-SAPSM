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
from app.services.ai_query import run_query

router = APIRouter(prefix="/ai", tags=["ai"])


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
