"""Audit log helper — called from any mutation endpoint."""

from __future__ import annotations

from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLog
from app.models.enums import AuditAction


async def record(
    db: AsyncSession,
    *,
    actor_user_id: Optional[int],
    action: AuditAction,
    entity_type: str,
    entity_id: Optional[int] = None,
    detail: Optional[str] = None,
) -> None:
    """Append a row to audit_log. Caller is responsible for commit."""
    db.add(
        AuditLog(
            actor_user_id=actor_user_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            detail=detail,
        )
    )
