"""Seat suggestion for new joiners.

Heuristic: find seats that are AVAILABLE, then rank by proximity to the
joiner's future team. Proximity is measured as "seats on the same
building+floor+zone as many teammates as possible", then building+floor,
then anywhere. Ties broken by seat_number for deterministic output.
"""

from __future__ import annotations

from typing import List, Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.employee import Employee
from app.models.enums import EmployeeStatus, SeatStatus
from app.models.seat import Seat


async def suggest_seats(
    db: AsyncSession,
    *,
    department: Optional[str] = None,
    project_id: Optional[int] = None,
    limit: int = 5,
) -> List[Seat]:
    """Return up to `limit` suggested available seats.

    Either department or project_id (or both) should be provided; if
    neither, we just return the first N available seats.
    """
    # 1. Collect teammates' occupied seats to figure out where the team sits.
    teammate_filters = []
    if department:
        teammate_filters.append(Employee.department == department)
    if project_id is not None:
        teammate_filters.append(Employee.current_project_id == project_id)

    hotspots: List[tuple[str, int, str]] = []  # (building, floor, zone) counts
    if teammate_filters:
        teammate_seats_stmt = (
            select(
                Seat.building,
                Seat.floor,
                Seat.zone,
                func.count(Employee.id).label("n"),
            )
            .join(Employee, Employee.current_seat_id == Seat.id)
            .where(
                Employee.status == EmployeeStatus.ACTIVE,
                *teammate_filters,
            )
            .group_by(Seat.building, Seat.floor, Seat.zone)
            .order_by(func.count(Employee.id).desc())
            .limit(5)
        )
        result = await db.execute(teammate_seats_stmt)
        hotspots = [(b, f, z) for b, f, z, _n in result.all()]

    # 2. For each hotspot, look for available seats there.
    suggestions: list[Seat] = []
    seen_ids: set[int] = set()

    for building, floor, zone in hotspots:
        if len(suggestions) >= limit:
            break
        stmt = (
            select(Seat)
            .where(
                Seat.status == SeatStatus.AVAILABLE,
                Seat.building == building,
                Seat.floor == floor,
                Seat.zone == zone,
            )
            .order_by(Seat.seat_number)
            .limit(limit - len(suggestions))
        )
        for s in (await db.execute(stmt)).scalars().all():
            if s.id not in seen_ids:
                suggestions.append(s)
                seen_ids.add(s.id)

    # 3. Widen to same building+floor if we still need more.
    if len(suggestions) < limit and hotspots:
        for building, floor, _zone in hotspots:
            if len(suggestions) >= limit:
                break
            stmt = (
                select(Seat)
                .where(
                    Seat.status == SeatStatus.AVAILABLE,
                    Seat.building == building,
                    Seat.floor == floor,
                )
                .order_by(Seat.seat_number)
                .limit(limit - len(suggestions))
            )
            for s in (await db.execute(stmt)).scalars().all():
                if s.id not in seen_ids:
                    suggestions.append(s)
                    seen_ids.add(s.id)

    # 4. Fallback: any available seat.
    if len(suggestions) < limit:
        stmt = (
            select(Seat)
            .where(Seat.status == SeatStatus.AVAILABLE)
            .order_by(Seat.building, Seat.floor, Seat.zone, Seat.seat_number)
            .limit(limit - len(suggestions))
        )
        for s in (await db.execute(stmt)).scalars().all():
            if s.id not in seen_ids:
                suggestions.append(s)
                seen_ids.add(s.id)

    return suggestions[:limit]
