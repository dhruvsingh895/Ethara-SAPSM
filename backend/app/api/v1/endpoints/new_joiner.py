"""New-joiner seat allocation endpoints."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_hr_or_admin
from app.db.session import get_db
from app.models.employee import Employee
from app.models.user import User
from app.schemas.allocation import AllocationOut
from app.schemas.seat import SeatOut
from app.services import allocation as alloc_svc
from app.services import new_joiner as nj_svc

router = APIRouter(prefix="/new-joiner", tags=["new-joiner"])


class SuggestRequest(BaseModel):
    department: Optional[str] = None
    project_id: Optional[int] = None
    limit: int = Field(default=5, ge=1, le=20)


class AllocateForJoinerRequest(BaseModel):
    employee_id: int
    seat_id: int
    note: Optional[str] = Field(default=None, max_length=255)


@router.post("/suggest", response_model=list[SeatOut], summary="Suggest seats for a joiner")
async def suggest(
    payload: SuggestRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[SeatOut]:
    seats = await nj_svc.suggest_seats(
        db,
        department=payload.department,
        project_id=payload.project_id,
        limit=payload.limit,
    )
    return [SeatOut.model_validate(s) for s in seats]


@router.get("/suggest", response_model=list[SeatOut], summary="Suggest seats via query params")
async def suggest_qs(
    department: Optional[str] = Query(None),
    project_id: Optional[int] = Query(None),
    limit: int = Query(5, ge=1, le=20),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[SeatOut]:
    seats = await nj_svc.suggest_seats(
        db, department=department, project_id=project_id, limit=limit
    )
    return [SeatOut.model_validate(s) for s in seats]


@router.post(
    "/allocate",
    response_model=AllocationOut,
    status_code=status.HTTP_201_CREATED,
    summary="Suggest + allocate a seat for a new joiner (HR/Admin)",
)
async def allocate_for_joiner(
    payload: AllocateForJoinerRequest,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_hr_or_admin),
) -> AllocationOut:
    """Convenience: if the caller has picked a seat from /suggest, this
    endpoint records the joiner's chosen seat as their first allocation.
    Delegates to the standard allocate service under the hood.
    """
    emp = await db.get(Employee, payload.employee_id)
    if emp is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Employee not found")

    alloc = await alloc_svc.allocate(
        db,
        seat_id=payload.seat_id,
        employee_id=payload.employee_id,
        actor_user_id=actor.id,
        note=payload.note or "new joiner allocation",
    )
    await db.commit()
    await db.refresh(alloc)
    return AllocationOut.model_validate(alloc)
