"""Seat suggestion for new joiners.

Heuristic — pack scarce zones first, near the team:

1. Find the (building, floor, zone) hotspots where the joiner's team
   already sits. Keep the top 5 by teammate count.
2. Compute the number of AVAILABLE seats in each hotspot zone.
3. **Rank hotspots by fewest available seats ascending.** This means
   we consume the last few empty desks in a densely-populated zone
   before spreading into a zone that's half empty. Real ops teams
   prefer this because it keeps utilization tight per floor and
   leaves whole zones for future team growth.
4. Fall back to same (building, floor), then any AVAILABLE seat,
   preserving the same "fewest first" ordering.
"""

from __future__ import annotations

from typing import List, Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.employee import Employee
from app.models.enums import EmployeeStatus, SeatStatus
from app.models.seat import Seat


async def _vacancy_count(
    db: AsyncSession,
    *,
    building: str,
    floor: int,
    zone: Optional[str] = None,
) -> int:
    stmt = select(func.count()).select_from(Seat).where(
        Seat.status == SeatStatus.AVAILABLE,
        Seat.building == building,
        Seat.floor == floor,
    )
    if zone is not None:
        stmt = stmt.where(Seat.zone == zone)
    return (await db.execute(stmt)).scalar_one()


async def suggest_seats(
    db: AsyncSession,
    *,
    department: Optional[str] = None,
    project_id: Optional[int] = None,
    limit: int = 5,
) -> List[Seat]:
    """Return up to `limit` suggested available seats, filling scarce zones first."""
    teammate_filters = []
    if department:
        teammate_filters.append(Employee.department == department)
    if project_id is not None:
        teammate_filters.append(Employee.current_project_id == project_id)

    hotspots: List[tuple[str, int, str]] = []
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

    # Rank hotspots by fewest-vacancies-ascending. If a zone has 0
    # vacancies we still skip it downstream (no seats to return); but
    # this keeps low-vacancy zones ahead of empty ones so they fill up.
    if hotspots:
        with_vac = []
        for b, f, z in hotspots:
            v = await _vacancy_count(db, building=b, floor=f, zone=z)
            with_vac.append((v, b, f, z))
        with_vac.sort(key=lambda t: (t[0], t[1], t[2], t[3]))
        hotspots = [(b, f, z) for v, b, f, z in with_vac if v > 0]

    suggestions: list[Seat] = []
    seen_ids: set[int] = set()

    # Tier 1: same zone as teammates, fewest vacancies first.
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

    # Tier 2: same (building, floor) as any hotspot, fewest vacancies
    # per floor first. Distinct floors so we don't hit the same floor twice.
    if len(suggestions) < limit and hotspots:
        seen_floors: set[tuple[str, int]] = set()
        floor_ranking: list[tuple[int, str, int]] = []
        for b, f, _z in hotspots:
            if (b, f) in seen_floors:
                continue
            seen_floors.add((b, f))
            v = await _vacancy_count(db, building=b, floor=f)
            if v > 0:
                floor_ranking.append((v, b, f))
        floor_ranking.sort(key=lambda t: (t[0], t[1], t[2]))
        for _v, building, floor in floor_ranking:
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

    # Tier 3: anywhere AVAILABLE, pack the floor with the fewest
    # vacancies first. One query per floor keeps the ordering intact.
    if len(suggestions) < limit:
        floor_stmt = (
            select(
                Seat.building,
                Seat.floor,
                func.count().label("v"),
            )
            .where(Seat.status == SeatStatus.AVAILABLE)
            .group_by(Seat.building, Seat.floor)
            .having(func.count() > 0)
            .order_by("v", Seat.building, Seat.floor)
        )
        for building, floor, _v in (await db.execute(floor_stmt)).all():
            if len(suggestions) >= limit:
                break
            stmt = (
                select(Seat)
                .where(
                    Seat.status == SeatStatus.AVAILABLE,
                    Seat.building == building,
                    Seat.floor == floor,
                )
                .order_by(Seat.zone, Seat.seat_number)
                .limit(limit - len(suggestions))
            )
            for s in (await db.execute(stmt)).scalars().all():
                if s.id not in seen_ids:
                    suggestions.append(s)
                    seen_ids.add(s.id)

    return suggestions[:limit]
