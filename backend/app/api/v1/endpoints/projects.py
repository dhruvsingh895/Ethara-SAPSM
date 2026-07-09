"""Projects CRUD + roster."""

from __future__ import annotations

from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_admin, require_pm_or_admin
from app.db.session import get_db
from app.models.employee import Employee
from app.models.enums import AuditAction, ProjectStatus
from app.models.project import Project
from app.models.project_assignment import ProjectAssignment
from app.models.user import User
from app.schemas.common import MessageResponse, Page, PageParams
from app.schemas.employee import EmployeeOut
from app.schemas.project import ProjectCreate, ProjectOut, ProjectUpdate
from app.schemas.project_assignment import (
    ProjectAssignmentCreate,
    ProjectAssignmentOut,
    ProjectAssignmentUpdate,
)
from app.services import audit

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("", response_model=Page[ProjectOut], summary="List projects")
async def list_projects(
    page: PageParams = Depends(),
    q: Optional[str] = Query(
        None,
        description="Substring search across name, code, client, description",
    ),
    status_: Optional[ProjectStatus] = Query(None, alias="status"),
    pm_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> Page[ProjectOut]:
    stmt = select(Project)
    count_stmt = select(func.count()).select_from(Project)

    filters = []
    if q:
        like = f"%{q.strip()}%"
        filters.append(
            or_(
                Project.name.ilike(like),
                Project.code.ilike(like),
                Project.client.ilike(like),
                Project.description.ilike(like),
            )
        )
    if status_:
        filters.append(Project.status == status_)
    if pm_id is not None:
        filters.append(Project.pm_id == pm_id)

    for f in filters:
        stmt = stmt.where(f)
        count_stmt = count_stmt.where(f)

    total = (await db.execute(count_stmt)).scalar_one()
    stmt = stmt.order_by(Project.id).limit(page.limit).offset(page.offset)
    items = (await db.execute(stmt)).scalars().all()

    return Page[ProjectOut](
        items=[ProjectOut.model_validate(p) for p in items],
        total=total,
        limit=page.limit,
        offset=page.offset,
    )


@router.get("/{project_id}", response_model=ProjectOut, summary="Get project by id")
async def get_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> ProjectOut:
    p = await db.get(Project, project_id)
    if p is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    return ProjectOut.model_validate(p)


@router.post(
    "",
    response_model=ProjectOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create project (Admin)",
)
async def create_project(
    payload: ProjectCreate,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_admin),
) -> ProjectOut:
    existing = (
        await db.execute(
            select(Project).where(
                or_(Project.code == payload.code, Project.name == payload.name)
            )
        )
    ).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Project code or name exists")

    p = Project(**payload.model_dump())
    db.add(p)
    await db.flush()
    await audit.record(
        db,
        actor_user_id=actor.id,
        action=AuditAction.ASSIGN_PROJECT,
        entity_type="project",
        entity_id=p.id,
        detail=f"created {p.code} {p.name}",
    )
    await db.commit()
    await db.refresh(p)
    return ProjectOut.model_validate(p)


@router.api_route(
    "/{project_id}",
    response_model=ProjectOut,
    summary="Update project (Admin)",
    methods=["PUT", "PATCH"],
)
async def update_project(
    project_id: int,
    payload: ProjectUpdate,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_admin),
) -> ProjectOut:
    p = await db.get(Project, project_id)
    if p is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")

    changes = payload.model_dump(exclude_unset=True)
    for k, v in changes.items():
        setattr(p, k, v)

    await db.flush()
    await audit.record(
        db,
        actor_user_id=actor.id,
        action=AuditAction.ASSIGN_PROJECT,
        entity_type="project",
        entity_id=p.id,
        detail=f"updated {sorted(changes.keys())}",
    )
    await db.commit()
    await db.refresh(p)
    return ProjectOut.model_validate(p)


@router.delete(
    "/{project_id}",
    response_model=MessageResponse,
    summary="Delete project (Admin)",
)
async def delete_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_admin),
) -> MessageResponse:
    p = await db.get(Project, project_id)
    if p is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    code = p.code
    await db.delete(p)
    await audit.record(
        db,
        actor_user_id=actor.id,
        action=AuditAction.UNASSIGN_PROJECT,
        entity_type="project",
        entity_id=project_id,
        detail=f"deleted {code}",
    )
    await db.commit()
    return MessageResponse(message="Project deleted")


# ---------------------------------------------------------------- roster --


@router.get(
    "/{project_id}/roster",
    response_model=Page[ProjectAssignmentOut],
    summary="List assignments for a project",
)
async def project_roster(
    project_id: int,
    page: PageParams = Depends(),
    active_only: bool = Query(True),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> Page[ProjectAssignmentOut]:
    p = await db.get(Project, project_id)
    if p is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")

    base = select(ProjectAssignment).where(ProjectAssignment.project_id == project_id)
    count_base = (
        select(func.count()).select_from(ProjectAssignment)
        .where(ProjectAssignment.project_id == project_id)
    )
    if active_only:
        today = date.today()
        base = base.where(
            or_(ProjectAssignment.end_date.is_(None), ProjectAssignment.end_date >= today)
        )
        count_base = count_base.where(
            or_(ProjectAssignment.end_date.is_(None), ProjectAssignment.end_date >= today)
        )

    total = (await db.execute(count_base)).scalar_one()
    stmt = base.order_by(ProjectAssignment.id).limit(page.limit).offset(page.offset)
    items = (await db.execute(stmt)).scalars().all()

    return Page[ProjectAssignmentOut](
        items=[ProjectAssignmentOut.model_validate(a) for a in items],
        total=total,
        limit=page.limit,
        offset=page.offset,
    )


@router.get(
    "/{project_id}/employees",
    response_model=Page[EmployeeOut],
    summary="List employees on a project (spec-shaped view of the roster)",
)
async def project_employees(
    project_id: int,
    page: PageParams = Depends(),
    active_only: bool = Query(True),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> Page[EmployeeOut]:
    """Spec-required endpoint: returns Employee rows for a project.

    Internally this is the same data as /roster but joined back to
    employees so the response shape matches GET /employees. The /roster
    endpoint is kept as-is because the frontend uses it for the
    per-assignment allocation percentages.
    """
    p = await db.get(Project, project_id)
    if p is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")

    join_cond = ProjectAssignment.project_id == project_id
    if active_only:
        today = date.today()
        join_cond = join_cond & (
            or_(ProjectAssignment.end_date.is_(None), ProjectAssignment.end_date >= today)
        )

    base = (
        select(Employee)
        .join(ProjectAssignment, ProjectAssignment.employee_id == Employee.id)
        .where(join_cond)
        .distinct()
    )
    count_stmt = (
        select(func.count(func.distinct(Employee.id)))
        .select_from(Employee)
        .join(ProjectAssignment, ProjectAssignment.employee_id == Employee.id)
        .where(join_cond)
    )

    total = (await db.execute(count_stmt)).scalar_one()
    stmt = base.order_by(Employee.id).limit(page.limit).offset(page.offset)
    items = (await db.execute(stmt)).scalars().all()

    return Page[EmployeeOut](
        items=[EmployeeOut.model_validate(e) for e in items],
        total=total,
        limit=page.limit,
        offset=page.offset,
    )


@router.post(
    "/{project_id}/assignments",
    response_model=ProjectAssignmentOut,
    status_code=status.HTTP_201_CREATED,
    summary="Assign an employee to a project (PM/Admin)",
)
async def create_assignment(
    project_id: int,
    payload: ProjectAssignmentCreate,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_pm_or_admin),
) -> ProjectAssignmentOut:
    if payload.project_id != project_id:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "URL project_id does not match payload.project_id",
        )
    p = await db.get(Project, project_id)
    if p is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")

    a = ProjectAssignment(**payload.model_dump())
    db.add(a)
    try:
        await db.flush()
    except Exception as e:  # unique constraint / FK violation
        await db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, f"Assignment conflict: {e}")

    await audit.record(
        db,
        actor_user_id=actor.id,
        action=AuditAction.ASSIGN_PROJECT,
        entity_type="project_assignment",
        entity_id=a.id,
        detail=f"emp={a.employee_id} proj={a.project_id} pct={a.allocation_pct}",
    )
    await db.commit()
    await db.refresh(a)
    return ProjectAssignmentOut.model_validate(a)


@router.patch(
    "/{project_id}/assignments/{assignment_id}",
    response_model=ProjectAssignmentOut,
    summary="Update an assignment (PM/Admin)",
)
async def update_assignment(
    project_id: int,
    assignment_id: int,
    payload: ProjectAssignmentUpdate,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_pm_or_admin),
) -> ProjectAssignmentOut:
    a = await db.get(ProjectAssignment, assignment_id)
    if a is None or a.project_id != project_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Assignment not found")

    changes = payload.model_dump(exclude_unset=True)
    for k, v in changes.items():
        setattr(a, k, v)

    await db.flush()
    await audit.record(
        db,
        actor_user_id=actor.id,
        action=AuditAction.ASSIGN_PROJECT,
        entity_type="project_assignment",
        entity_id=a.id,
        detail=f"updated {sorted(changes.keys())}",
    )
    await db.commit()
    await db.refresh(a)
    return ProjectAssignmentOut.model_validate(a)


@router.delete(
    "/{project_id}/assignments/{assignment_id}",
    response_model=MessageResponse,
    summary="Remove an assignment (PM/Admin)",
)
async def delete_assignment(
    project_id: int,
    assignment_id: int,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_pm_or_admin),
) -> MessageResponse:
    a = await db.get(ProjectAssignment, assignment_id)
    if a is None or a.project_id != project_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Assignment not found")
    emp_id = a.employee_id
    await db.delete(a)
    await audit.record(
        db,
        actor_user_id=actor.id,
        action=AuditAction.UNASSIGN_PROJECT,
        entity_type="project_assignment",
        entity_id=assignment_id,
        detail=f"removed emp={emp_id} from proj={project_id}",
    )
    await db.commit()
    return MessageResponse(message="Assignment removed")
