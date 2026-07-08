"""User account management (admin-only).

Admin can create login credentials for HR/PM/employee users, toggle
their active flag, reset passwords, or delete them. Two self-protection
guards apply on delete + role-change:

- Admin cannot delete their own account.
- The last remaining admin cannot be demoted or deactivated.

These guards live in the endpoint layer because they involve the
`actor` identity, not just DB state.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_admin
from app.core.security import hash_password
from app.db.session import get_db
from app.models.enums import AuditAction, UserRole
from app.models.user import User
from app.schemas.auth import UserPublic
from app.schemas.common import MessageResponse
from app.schemas.user import UserCreate, UserUpdate
from app.services import audit

router = APIRouter(prefix="/users", tags=["users"])


async def _active_admin_count(db: AsyncSession, *, exclude_id: int | None = None) -> int:
    stmt = select(func.count()).select_from(User).where(
        User.role == UserRole.ADMIN,
        User.is_active.is_(True),
    )
    if exclude_id is not None:
        stmt = stmt.where(User.id != exclude_id)
    return (await db.execute(stmt)).scalar_one()


@router.get("", response_model=list[UserPublic], summary="List users (Admin)")
async def list_users(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> list[UserPublic]:
    rows = (
        await db.execute(select(User).order_by(User.id))
    ).scalars().all()
    return [UserPublic.model_validate(u) for u in rows]


@router.post(
    "",
    response_model=UserPublic,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new user (Admin)",
)
async def create_user(
    payload: UserCreate,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_admin),
) -> UserPublic:
    username = payload.username.strip().lower()
    email = payload.email.strip().lower()

    existing = (
        await db.execute(
            select(User).where(
                or_(User.username == username, User.email == email)
            )
        )
    ).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "A user with that username or email already exists",
        )

    user = User(
        username=username,
        email=email,
        hashed_password=hash_password(payload.password),
        role=payload.role,
        is_active=True,
        employee_id=payload.employee_id,
    )
    db.add(user)
    await db.flush()
    await audit.record(
        db,
        actor_user_id=actor.id,
        action=AuditAction.CHANGE_ROLE,  # closest existing action
        entity_type="user",
        entity_id=user.id,
        detail=f"created {user.username} as {user.role.value}",
    )
    await db.commit()
    await db.refresh(user)
    return UserPublic.model_validate(user)


@router.patch(
    "/{user_id}",
    response_model=UserPublic,
    summary="Update a user's role, email, password, or active flag (Admin)",
)
async def update_user(
    user_id: int,
    payload: UserUpdate,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_admin),
) -> UserPublic:
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")

    changes = payload.model_dump(exclude_unset=True)

    # Self-protection: don't let the acting admin lock themselves out.
    if user.id == actor.id and (
        changes.get("is_active") is False
        or (
            changes.get("role") is not None
            and changes["role"] != UserRole.ADMIN
        )
    ):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "You cannot demote or deactivate your own account.",
        )

    # Last-admin protection.
    if user.role == UserRole.ADMIN:
        will_lose_admin = (
            (changes.get("role") is not None and changes["role"] != UserRole.ADMIN)
            or changes.get("is_active") is False
        )
        if will_lose_admin:
            remaining = await _active_admin_count(db, exclude_id=user.id)
            if remaining == 0:
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST,
                    "Refusing to remove the last active admin. "
                    "Promote another user to admin first.",
                )

    # Apply changes.
    if "email" in changes:
        user.email = changes["email"].strip().lower()
    if "role" in changes and changes["role"] is not None:
        user.role = changes["role"]
    if "is_active" in changes and changes["is_active"] is not None:
        user.is_active = changes["is_active"]
    if "employee_id" in changes:
        user.employee_id = changes["employee_id"]
    if "password" in changes and changes["password"]:
        user.hashed_password = hash_password(changes["password"])

    await db.flush()
    await audit.record(
        db,
        actor_user_id=actor.id,
        action=AuditAction.CHANGE_ROLE,
        entity_type="user",
        entity_id=user.id,
        detail=f"patched {sorted(k for k in changes if k != 'password')}"
        + (" +password" if changes.get("password") else ""),
    )
    await db.commit()
    await db.refresh(user)
    return UserPublic.model_validate(user)


@router.delete(
    "/{user_id}",
    response_model=MessageResponse,
    summary="Delete a user (Admin)",
)
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_admin),
) -> MessageResponse:
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")

    if user.id == actor.id:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "You cannot delete your own account.",
        )

    if user.role == UserRole.ADMIN:
        remaining = await _active_admin_count(db, exclude_id=user.id)
        if remaining == 0:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "Refusing to delete the last active admin. "
                "Promote another user to admin first.",
            )

    username = user.username
    await db.delete(user)
    await audit.record(
        db,
        actor_user_id=actor.id,
        action=AuditAction.CHANGE_ROLE,
        entity_type="user",
        entity_id=user_id,
        detail=f"deleted user {username}",
    )
    await db.commit()
    return MessageResponse(message=f"Deleted user '{username}'")
