"""Seat allocation endpoints."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_hr_or_admin
from app.db.session import get_db
from app.models.seat_allocation import SeatAllocation
from app.models.user import User
from app.schemas.allocation import (
    AllocationCreate,
    AllocationOut,
    AllocationRelease,
    AllocationTransfer,
)
from app.schemas.common import Page, PageParams
from app.services import allocation as alloc_svc

router = APIRouter(prefix="/allocations", tags=["allocations"])


@router.get("", response_model=Page[AllocationOut], summary="List seat allocations")
async def list_allocations(
    page: PageParams = Depends(),
    active_only: bool = Query(True),
    employee_id: Optional[int] = Query(None),
    seat_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> Page[AllocationOut]:
    stmt = select(SeatAllocation)
    count_stmt = select(func.count()).select_from(SeatAllocation)

    if active_only:
        stmt = stmt.where(SeatAllocation.released_at.is_(None))
        count_stmt = count_stmt.where(SeatAllocation.released_at.is_(None))
    if employee_id is not None:
        stmt = stmt.where(SeatAllocation.employee_id == employee_id)
        count_stmt = count_stmt.where(SeatAllocation.employee_id == employee_id)
    if seat_id is not None:
        stmt = stmt.where(SeatAllocation.seat_id == seat_id)
        count_stmt = count_stmt.where(SeatAllocation.seat_id == seat_id)

    total = (await db.execute(count_stmt)).scalar_one()
    stmt = stmt.order_by(SeatAllocation.allocated_at.desc()).limit(page.limit).offset(
        page.offset
    )
    items = (await db.execute(stmt)).scalars().all()

    return Page[AllocationOut](
        items=[AllocationOut.model_validate(a) for a in items],
        total=total,
        limit=page.limit,
        offset=page.offset,
    )


@router.get("/{allocation_id}", response_model=AllocationOut, summary="Get allocation")
async def get_allocation(
    allocation_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> AllocationOut:
    a = await db.get(SeatAllocation, allocation_id)
    if a is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Allocation not found")
    return AllocationOut.model_validate(a)


@router.post(
    "",
    response_model=AllocationOut,
    status_code=status.HTTP_201_CREATED,
    summary="Allocate a seat to an employee (HR/Admin)",
)
async def create_allocation(
    payload: AllocationCreate,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_hr_or_admin),
) -> AllocationOut:
    alloc = await alloc_svc.allocate(
        db,
        seat_id=payload.seat_id,
        employee_id=payload.employee_id,
        actor_user_id=actor.id,
        note=payload.note,
    )
    await db.commit()
    await db.refresh(alloc)
    return AllocationOut.model_validate(alloc)


@router.post(
    "/{allocation_id}/release",
    response_model=AllocationOut,
    summary="Release a seat allocation (HR/Admin)",
)
async def release_allocation(
    allocation_id: int,
    payload: AllocationRelease = AllocationRelease(),
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_hr_or_admin),
) -> AllocationOut:
    alloc = await alloc_svc.release(
        db,
        allocation_id=allocation_id,
        actor_user_id=actor.id,
        note=payload.note,
    )
    await db.commit()
    await db.refresh(alloc)
    return AllocationOut.model_validate(alloc)


@router.post(
    "/transfer",
    response_model=AllocationOut,
    summary="Transfer an employee to a new seat (HR/Admin)",
)
async def transfer_allocation(
    payload: AllocationTransfer,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_hr_or_admin),
) -> AllocationOut:
    alloc = await alloc_svc.transfer(
        db,
        employee_id=payload.employee_id,
        new_seat_id=payload.new_seat_id,
        actor_user_id=actor.id,
        note=payload.note,
    )
    await db.commit()
    await db.refresh(alloc)
    return AllocationOut.model_validate(alloc)
