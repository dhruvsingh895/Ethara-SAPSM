"""Dashboard aggregates.

All reads; open to any authenticated user. Queries are written to hit
existing indexes (status/floor, department/status, current_project_id).
"""

from __future__ import annotations

from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.employee import Employee
from app.models.enums import EmployeeStatus, ProjectStatus, SeatStatus
from app.models.project import Project
from app.models.project_assignment import ProjectAssignment
from app.models.seat import Seat
from app.models.user import User
from app.schemas.dashboard import (
    FloorOccupancy,
    HeadcountByDept,
    OccupancySummary,
    OverviewResponse,
    ProjectUtilization,
)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


async def _occupancy_summary(db: AsyncSession) -> OccupancySummary:
    rows = (
        await db.execute(
            select(Seat.status, func.count()).group_by(Seat.status)
        )
    ).all()
    counts = {status: n for status, n in rows}
    available = counts.get(SeatStatus.AVAILABLE, 0)
    occupied = counts.get(SeatStatus.OCCUPIED, 0)
    reserved = counts.get(SeatStatus.RESERVED, 0)
    blocked = counts.get(SeatStatus.BLOCKED, 0)
    total = available + occupied + reserved + blocked
    pct = round((occupied / total) * 100, 2) if total else 0.0
    return OccupancySummary(
        total_seats=total,
        available=available,
        occupied=occupied,
        reserved=reserved,
        blocked=blocked,
        occupancy_pct=pct,
    )


@router.get("/occupancy", response_model=OccupancySummary, summary="Overall seat occupancy")
async def occupancy(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> OccupancySummary:
    return await _occupancy_summary(db)


@router.get(
    "/occupancy/by-floor",
    response_model=list[FloorOccupancy],
    summary="Occupancy grouped by building and floor",
)
async def occupancy_by_floor(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[FloorOccupancy]:
    rows = (
        await db.execute(
            select(
                Seat.building,
                Seat.floor,
                Seat.status,
                func.count().label("n"),
            ).group_by(Seat.building, Seat.floor, Seat.status)
            .order_by(Seat.building, Seat.floor)
        )
    ).all()

    grouped: dict[tuple[str, int], dict] = {}
    for building, floor, status, n in rows:
        key = (building, floor)
        d = grouped.setdefault(key, {"total": 0, "occupied": 0, "available": 0})
        d["total"] += n
        if status == SeatStatus.OCCUPIED:
            d["occupied"] += n
        elif status == SeatStatus.AVAILABLE:
            d["available"] += n

    out: list[FloorOccupancy] = []
    for (building, floor), d in grouped.items():
        pct = round((d["occupied"] / d["total"]) * 100, 2) if d["total"] else 0.0
        out.append(
            FloorOccupancy(
                building=building,
                floor=floor,
                total=d["total"],
                occupied=d["occupied"],
                available=d["available"],
                occupancy_pct=pct,
            )
        )
    return out


@router.get(
    "/projects/utilization",
    response_model=list[ProjectUtilization],
    summary="Project utilization (active members vs required seats)",
)
async def project_utilization(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[ProjectUtilization]:
    today = date.today()
    subq = (
        select(
            ProjectAssignment.project_id,
            func.count(func.distinct(ProjectAssignment.employee_id)).label("n"),
        )
        .where(
            (ProjectAssignment.end_date.is_(None))
            | (ProjectAssignment.end_date >= today)
        )
        .group_by(ProjectAssignment.project_id)
        .subquery()
    )
    stmt = (
        select(Project, subq.c.n)
        .outerjoin(subq, Project.id == subq.c.project_id)
        .order_by(Project.id)
    )
    rows = (await db.execute(stmt)).all()

    out: list[ProjectUtilization] = []
    for proj, n in rows:
        n = n or 0
        pct = (
            round((n / proj.required_seats) * 100, 2) if proj.required_seats else 0.0
        )
        out.append(
            ProjectUtilization(
                project_id=proj.id,
                project_code=proj.code,
                project_name=proj.name,
                active_members=n,
                required_seats=proj.required_seats,
                utilization_pct=pct,
            )
        )
    return out


@router.get("/overview", response_model=OverviewResponse, summary="Landing-page overview")
async def overview(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> OverviewResponse:
    summary = await _occupancy_summary(db)

    active_emp = (
        await db.execute(
            select(func.count()).select_from(Employee).where(
                Employee.status == EmployeeStatus.ACTIVE
            )
        )
    ).scalar_one()

    cutoff = date.today() - timedelta(days=30)
    joiners_30d = (
        await db.execute(
            select(func.count()).select_from(Employee).where(
                Employee.joining_date >= cutoff
            )
        )
    ).scalar_one()

    active_projects = (
        await db.execute(
            select(func.count()).select_from(Project).where(
                Project.status == ProjectStatus.ACTIVE
            )
        )
    ).scalar_one()

    dept_rows = (
        await db.execute(
            select(Employee.department, func.count().label("n"))
            .where(Employee.status == EmployeeStatus.ACTIVE)
            .group_by(Employee.department)
            .order_by(func.count().desc())
            .limit(5)
        )
    ).all()

    return OverviewResponse(
        occupancy=summary,
        active_employees=active_emp,
        joiners_last_30_days=joiners_30d,
        active_projects=active_projects,
        top_departments=[HeadcountByDept(department=d, active=n) for d, n in dept_rows],
    )
