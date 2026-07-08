"""Shared FastAPI dependencies: DB session, current user, role guards."""

from __future__ import annotations

from typing import Iterable

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.security import decode_token
from app.db.session import get_db
from app.models.enums import UserRole
from app.models.user import User

_settings = get_settings()

# tokenUrl matches the login endpoint so Swagger's "Authorize" button works.
oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{_settings.api_v1_prefix}/auth/login",
    auto_error=True,
)


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    creds_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_token(token)
    except ValueError:
        raise creds_error

    sub = payload.get("sub")
    if sub is None:
        raise creds_error

    try:
        user_id = int(sub)
    except (TypeError, ValueError):
        raise creds_error

    user = (
        await db.execute(select(User).where(User.id == user_id))
    ).scalar_one_or_none()
    if user is None or not user.is_active:
        raise creds_error
    return user


def require_roles(*allowed: UserRole):
    """Dependency factory: gate an endpoint to a set of roles."""
    allowed_set = set(allowed)

    async def _dep(current: User = Depends(get_current_user)) -> User:
        if current.role not in allowed_set:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires one of roles: {', '.join(r.value for r in allowed_set)}",
            )
        return current

    return _dep


# Convenience shortcuts used across routers.
require_admin = require_roles(UserRole.ADMIN)
require_hr_or_admin = require_roles(UserRole.HR, UserRole.ADMIN)
require_pm_or_admin = require_roles(UserRole.PM, UserRole.ADMIN)


def require_any(roles: Iterable[UserRole]):
    return require_roles(*roles)
