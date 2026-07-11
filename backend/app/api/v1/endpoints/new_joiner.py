"""New-joiner seat allocation endpoints."""

from __future__ import annotations

from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_hr_or_admin
from app.db.session import get_db
from app.models.employee import Employee
from app.models.enums import AuditAction
from app.models.project import Project
from app.models.project_assignment import ProjectAssignment
from app.models.user import User
from app.schemas.allocation import AllocationOut
from app.schemas.seat import SeatOut
from app.services import allocation as alloc_svc
from app.services import audit
from app.services import new_joiner as nj_svc

router = APIRouter(prefix="/new-joiner", tags=["new-joiner"])


class SuggestRequest(BaseModel):
    department: Optional[str] = None
    project_id: Optional[int] = None
    limit: int = Field(default=5, ge=1, le=20)


class AllocateForJoinerRequest(BaseModel):
    employee_id: int
    seat_id: int
    # Spec §3.2: each employee is mapped to one active project. If the
    # caller passes project_id we create the active assignment in the
    # same transaction as the seat allocation (fail-together).
    project_id: Optional[int] = None
    role: Optional[str] = Field(default=None, max_length=80)
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

    # Optional project assignment — resolved BEFORE the seat allocation so
    # any spec §3.2 violation (employee already on a project, project not
    # found) fails cleanly without leaving a half-completed side-effect.
    project: Optional[Project] = None
    if payload.project_id is not None:
        project = await db.get(Project, payload.project_id)
        if project is None:
            raise HTTPException(
                status.HTTP_404_NOT_FOUND,
                f"Project {payload.project_id} not found",
            )
        existing_active = (
            await db.execute(
                select(ProjectAssignment).where(
                    ProjectAssignment.employee_id == payload.employee_id,
                    ProjectAssignment.end_date.is_(None),
                )
            )
        ).scalar_one_or_none()
        if existing_active is not None:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                f"Employee {payload.employee_id} already has an active "
                f"assignment on project {existing_active.project_id}. Close "
                f"it first before mapping to a new project.",
            )

    alloc = await alloc_svc.allocate(
        db,
        seat_id=payload.seat_id,
        employee_id=payload.employee_id,
        actor_user_id=actor.id,
        note=payload.note or "new joiner allocation",
    )

    if project is not None:
        start = max(project.start_date or date.today(), emp.joining_date)
        if start > date.today():
            start = date.today()
        assignment = ProjectAssignment(
            employee_id=payload.employee_id,
            project_id=project.id,
            role=payload.role or "Developer",
            allocation_pct=100,
            start_date=start,
        )
        db.add(assignment)
        emp.current_project_id = project.id
        await db.flush()
        await audit.record(
            db,
            actor_user_id=actor.id,
            action=AuditAction.ASSIGN_PROJECT,
            entity_type="project_assignment",
            entity_id=assignment.id,
            detail=f"new-joiner emp={payload.employee_id} proj={project.id}",
        )

    await db.commit()
    await db.refresh(alloc)
    return AllocationOut.model_validate(alloc)
