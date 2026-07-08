"""Seats CRUD.

Writes (create/update/delete/block/reserve) are Admin-only.
Reads are open to any authenticated user.
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_admin
from app.db.session import get_db
from app.models.enums import AuditAction, SeatStatus
from app.models.seat import Seat
from app.models.user import User
from app.schemas.common import MessageResponse, Page, PageParams
from app.schemas.seat import SeatCreate, SeatOut, SeatUpdate
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


@router.patch("/{seat_id}", response_model=SeatOut, summary="Update seat (Admin)")
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
    for k, v in changes.items():
        setattr(seat, k, v)

    action = AuditAction.RESERVE
    if "status" in changes:
        if changes["status"] == SeatStatus.BLOCKED:
            action = AuditAction.BLOCK
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
        action=AuditAction.BLOCK,
        entity_type="seat",
        entity_id=seat_id,
        detail=f"deleted {code}",
    )
    await db.commit()
    return MessageResponse(message="Seat deleted")
