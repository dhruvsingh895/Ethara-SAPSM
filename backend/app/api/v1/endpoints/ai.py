"""AI assistant endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.ai import AiQueryRequest, AiQueryResponse
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
