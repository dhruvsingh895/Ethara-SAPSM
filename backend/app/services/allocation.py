"""Seat allocation, release, and transfer.

All three ops must move `seats.status`, `employees.current_seat_id`, and
`seat_allocations` together. The caller commits — this module only
flushes and validates so it can compose inside a larger transaction.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.employee import Employee
from app.models.enums import AuditAction, EmployeeStatus, SeatStatus
from app.models.seat import Seat
from app.models.seat_allocation import SeatAllocation
from app.services import audit


class AllocationError(HTTPException):
    def __init__(self, msg: str, code: int = status.HTTP_409_CONFLICT):
        super().__init__(status_code=code, detail=msg)


async def _get_active_allocation(
    db: AsyncSession, *, seat_id: int
) -> Optional[SeatAllocation]:
    return (
        await db.execute(
            select(SeatAllocation).where(
                and_(
                    SeatAllocation.seat_id == seat_id,
                    SeatAllocation.released_at.is_(None),
                )
            )
        )
    ).scalar_one_or_none()


async def _get_employee_active_allocation(
    db: AsyncSession, *, employee_id: int
) -> Optional[SeatAllocation]:
    return (
        await db.execute(
            select(SeatAllocation).where(
                and_(
                    SeatAllocation.employee_id == employee_id,
                    SeatAllocation.released_at.is_(None),
                )
            )
        )
    ).scalar_one_or_none()


async def allocate(
    db: AsyncSession,
    *,
    seat_id: int,
    employee_id: int,
    actor_user_id: int,
    note: Optional[str] = None,
) -> SeatAllocation:
    """Allocate a seat to an employee. Both must be free."""
    seat = await db.get(Seat, seat_id)
    if seat is None:
        raise AllocationError("Seat not found", status.HTTP_404_NOT_FOUND)
    if seat.status != SeatStatus.AVAILABLE:
        raise AllocationError(f"Seat {seat.seat_code} is {seat.status.value}")

    emp = await db.get(Employee, employee_id)
    if emp is None:
        raise AllocationError("Employee not found", status.HTTP_404_NOT_FOUND)
    if emp.status == EmployeeStatus.EXITED:
        raise AllocationError("Cannot allocate to an exited employee")
    if emp.current_seat_id is not None:
        raise AllocationError(
            f"Employee already occupies seat_id={emp.current_seat_id}. "
            "Release or transfer instead."
        )

    alloc = SeatAllocation(
        seat_id=seat_id,
        employee_id=employee_id,
        allocated_at=datetime.now(timezone.utc),
        allocated_by_id=actor_user_id,
        note=note,
    )
    db.add(alloc)
    seat.status = SeatStatus.OCCUPIED
    emp.current_seat_id = seat_id

    await db.flush()
    await audit.record(
        db,
        actor_user_id=actor_user_id,
        action=AuditAction.ALLOCATE,
        entity_type="seat_allocation",
        entity_id=alloc.id,
        detail=f"seat={seat.seat_code} emp={emp.emp_code}",
    )
    return alloc


async def release(
    db: AsyncSession,
    *,
    allocation_id: int,
    actor_user_id: int,
    note: Optional[str] = None,
) -> SeatAllocation:
    """Release an active allocation."""
    alloc = await db.get(SeatAllocation, allocation_id)
    if alloc is None:
        raise AllocationError("Allocation not found", status.HTTP_404_NOT_FOUND)
    if alloc.released_at is not None:
        raise AllocationError("Allocation is already released")

    seat = await db.get(Seat, alloc.seat_id)
    emp = await db.get(Employee, alloc.employee_id)

    alloc.released_at = datetime.now(timezone.utc)
    alloc.released_by_id = actor_user_id
    if note:
        alloc.note = (alloc.note + " | " if alloc.note else "") + note

    if seat is not None and seat.status == SeatStatus.OCCUPIED:
        seat.status = SeatStatus.AVAILABLE
    if emp is not None and emp.current_seat_id == alloc.seat_id:
        emp.current_seat_id = None

    await db.flush()
    await audit.record(
        db,
        actor_user_id=actor_user_id,
        action=AuditAction.RELEASE,
        entity_type="seat_allocation",
        entity_id=alloc.id,
        detail=(
            f"seat={seat.seat_code if seat else alloc.seat_id} "
            f"emp={emp.emp_code if emp else alloc.employee_id}"
        ),
    )
    return alloc


async def transfer(
    db: AsyncSession,
    *,
    employee_id: int,
    new_seat_id: int,
    actor_user_id: int,
    note: Optional[str] = None,
) -> SeatAllocation:
    """Move an employee to a new seat. Releases the current one first."""
    emp = await db.get(Employee, employee_id)
    if emp is None:
        raise AllocationError("Employee not found", status.HTTP_404_NOT_FOUND)
    if emp.current_seat_id is None:
        raise AllocationError(
            "Employee has no active seat. Use allocate instead of transfer."
        )
    if emp.current_seat_id == new_seat_id:
        raise AllocationError("Employee is already on that seat")

    current = await _get_employee_active_allocation(db, employee_id=employee_id)
    if current is not None:
        await release(
            db,
            allocation_id=current.id,
            actor_user_id=actor_user_id,
            note=f"transfer to seat_id={new_seat_id}",
        )

    new_alloc = await allocate(
        db,
        seat_id=new_seat_id,
        employee_id=employee_id,
        actor_user_id=actor_user_id,
        note=note or "transfer",
    )
    await audit.record(
        db,
        actor_user_id=actor_user_id,
        action=AuditAction.TRANSFER,
        entity_type="seat_allocation",
        entity_id=new_alloc.id,
        detail=f"emp={emp.emp_code} to seat_id={new_seat_id}",
    )
    return new_alloc
