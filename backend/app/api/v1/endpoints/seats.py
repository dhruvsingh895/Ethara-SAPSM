"""Seats CRUD.

Writes (create/update/delete/block/reserve) are Admin-only.
Reads are open to any authenticated user.
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_admin, require_hr_or_admin
from app.db.session import get_db
from app.models.enums import AuditAction, SeatStatus
from app.models.seat import Seat
from app.models.seat_allocation import SeatAllocation
from app.models.user import User
from app.schemas.allocation import (
    AllocationCreate,
    AllocationOut,
    AllocationRelease,
)
from app.schemas.common import MessageResponse, Page, PageParams
from app.schemas.seat import SeatCreate, SeatOut, SeatUpdate
from app.services import allocation as alloc_svc
from app.services import audit

router = APIRouter(prefix="/seats", tags=["seats"])


@router.get("", response_model=Page[SeatOut], summary="List seats")
async def list_seats(
    page: PageParams = Depends(),
    q: Optional[str] = Query(None, description="Search by seat_code"),
    building: Optional[str] = Query(None),
    floor: Optional[int] = Query(None),
    zone: Optional[str] = Query(None),
    status_: Optional[SeatStatus] = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> Page[SeatOut]:
    stmt = select(Seat)
    count_stmt = select(func.count()).select_from(Seat)

    filters = []
    if q:
        filters.append(Seat.seat_code.ilike(f"%{q.strip()}%"))
    if building:
        filters.append(Seat.building == building)
    if floor is not None:
        filters.append(Seat.floor == floor)
    if zone:
        filters.append(Seat.zone == zone)
    if status_:
        filters.append(Seat.status == status_)

    for f in filters:
        stmt = stmt.where(f)
        count_stmt = count_stmt.where(f)

    total = (await db.execute(count_stmt)).scalar_one()
    stmt = stmt.order_by(Seat.id).limit(page.limit).offset(page.offset)
    items = (await db.execute(stmt)).scalars().all()

    return Page[SeatOut](
        items=[SeatOut.model_validate(s) for s in items],
        total=total,
        limit=page.limit,
        offset=page.offset,
    )


@router.get(
    "/available",
    response_model=Page[SeatOut],
    summary="List currently-available seats",
)
async def list_available(
    page: PageParams = Depends(),
    building: Optional[str] = Query(None),
    floor: Optional[int] = Query(None),
    zone: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> Page[SeatOut]:
    stmt = select(Seat).where(Seat.status == SeatStatus.AVAILABLE)
    count_stmt = select(func.count()).select_from(Seat).where(
        Seat.status == SeatStatus.AVAILABLE
    )
    for name, val in [("building", building), ("zone", zone)]:
        if val:
            col = getattr(Seat, name)
            stmt = stmt.where(col == val)
            count_stmt = count_stmt.where(col == val)
    if floor is not None:
        stmt = stmt.where(Seat.floor == floor)
        count_stmt = count_stmt.where(Seat.floor == floor)

    total = (await db.execute(count_stmt)).scalar_one()
    stmt = stmt.order_by(Seat.building, Seat.floor, Seat.zone, Seat.seat_number).limit(
        page.limit
    ).offset(page.offset)
    items = (await db.execute(stmt)).scalars().all()

    return Page[SeatOut](
        items=[SeatOut.model_validate(s) for s in items],
        total=total,
        limit=page.limit,
        offset=page.offset,
    )


# -------------------------------------------------------------------
# Spec-shape aliases: POST /seats/allocate and POST /seats/release.
# Internally these delegate to the same service the /allocations
# endpoints use, so both API shapes stay in lockstep. Registered BEFORE
# the /{seat_id} route so the literal paths aren't captured as ids.
# -------------------------------------------------------------------


class SeatReleaseRequest(AllocationRelease):
    seat_id: int


@router.post(
    "/allocate",
    response_model=AllocationOut,
    status_code=status.HTTP_201_CREATED,
    summary="Allocate a seat to an employee (spec alias for POST /allocations)",
)
async def allocate_seat(
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
    "/release",
    response_model=AllocationOut,
    summary="Release the active allocation on a seat (spec alias)",
)
async def release_seat(
    payload: SeatReleaseRequest,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_hr_or_admin),
) -> AllocationOut:
    """Release whichever allocation is currently active on `seat_id`."""
    from sqlalchemy import and_ as _and

    alloc = (
        await db.execute(
            select(SeatAllocation).where(
                _and(
                    SeatAllocation.seat_id == payload.seat_id,
                    SeatAllocation.released_at.is_(None),
                )
            )
        )
    ).scalar_one_or_none()
    if alloc is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            f"No active allocation on seat_id={payload.seat_id}",
        )
    alloc = await alloc_svc.release(
        db,
        allocation_id=alloc.id,
        actor_user_id=actor.id,
        note=payload.note,
    )
    await db.commit()
    await db.refresh(alloc)
    return AllocationOut.model_validate(alloc)


@router.get("/{seat_id}", response_model=SeatOut, summary="Get seat by id")
async def get_seat(
    seat_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> SeatOut:
    seat = await db.get(Seat, seat_id)
    if seat is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Seat not found")
    return SeatOut.model_validate(seat)


@router.post(
    "",
    response_model=SeatOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create seat (Admin)",
)
async def create_seat(
    payload: SeatCreate,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_admin),
) -> SeatOut:
    existing = (
        await db.execute(select(Seat).where(Seat.seat_code == payload.seat_code))
    ).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "seat_code already exists")

    seat = Seat(**payload.model_dump())
    db.add(seat)
    await db.flush()
    await audit.record(
        db,
        actor_user_id=actor.id,
        action=AuditAction.RESERVE,
        entity_type="seat",
        entity_id=seat.id,
        detail=f"created {seat.seat_code}",
    )
    await db.commit()
    await db.refresh(seat)
    return SeatOut.model_validate(seat)


@router.api_route(
    "/{seat_id}",
    response_model=SeatOut,
    summary="Update seat (Admin)",
    methods=["PUT", "PATCH"],
)
async def update_seat(
    seat_id: int,
    payload: SeatUpdate,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_admin),
) -> SeatOut:
    seat = await db.get(Seat, seat_id)
    if seat is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Seat not found")

    changes = payload.model_dump(exclude_unset=True)
    old_status = seat.status

    # Refuse status transitions that would leave the current occupant
    # in a non-occupied seat. Caller must release the allocation first.
    new_status = changes.get("status")
    if (
        new_status is not None
        and old_status == SeatStatus.OCCUPIED
        and new_status != SeatStatus.OCCUPIED
    ):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Seat is currently occupied. Release the active allocation "
            "before changing its status.",
        )

    for k, v in changes.items():
        setattr(seat, k, v)

    action = AuditAction.RESERVE
    if "status" in changes:
        if changes["status"] == SeatStatus.MAINTENANCE:
            action = AuditAction.MAINTENANCE
        elif changes["status"] == SeatStatus.RESERVED:
            action = AuditAction.RESERVE

    await db.flush()
    await audit.record(
        db,
        actor_user_id=actor.id,
        action=action,
        entity_type="seat",
        entity_id=seat.id,
        detail=f"updated {sorted(changes.keys())} (status {old_status.value}->"
        f"{seat.status.value})",
    )
    await db.commit()
    await db.refresh(seat)
    return SeatOut.model_validate(seat)


@router.delete(
    "/{seat_id}",
    response_model=MessageResponse,
    summary="Delete seat (Admin)",
)
async def delete_seat(
    seat_id: int,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_admin),
) -> MessageResponse:
    seat = await db.get(Seat, seat_id)
    if seat is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Seat not found")
    if seat.status == SeatStatus.OCCUPIED:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Cannot delete an occupied seat. Release it first.",
        )
    code = seat.seat_code
    await db.delete(seat)
    await audit.record(
        db,
        actor_user_id=actor.id,
        action=AuditAction.MAINTENANCE,
        entity_type="seat",
        entity_id=seat_id,
        detail=f"deleted {code}",
    )
    await db.commit()
    return MessageResponse(message="Seat deleted")
