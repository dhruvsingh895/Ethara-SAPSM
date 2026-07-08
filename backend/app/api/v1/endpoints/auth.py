"""Auth endpoints: login and current user."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.core.security import create_access_token, verify_password
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import TokenResponse, UserPublic

router = APIRouter(prefix="/auth", tags=["auth"])

_settings = get_settings()


@router.post("/login", response_model=TokenResponse, summary="Log in and get a JWT")
async def login(
    form: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """Accepts application/x-www-form-urlencoded (per OAuth2 spec) with
    `username` and `password`. `username` may also be the user's email.
    """
    identifier = form.username.strip().lower()
    user = (
        await db.execute(
            select(User).where(
                or_(User.username == identifier, User.email == identifier)
            )
        )
    ).scalar_one_or_none()

    if user is None or not verify_password(form.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled",
        )

    token = create_access_token(user.id, extra={"role": user.role.value})
    return TokenResponse(
        access_token=token,
        expires_in=_settings.access_token_expire_minutes * 60,
        user=UserPublic.model_validate(user),
    )


@router.get("/me", response_model=UserPublic, summary="Get the current user")
async def me(current: User = Depends(get_current_user)) -> UserPublic:
    return UserPublic.model_validate(current)
