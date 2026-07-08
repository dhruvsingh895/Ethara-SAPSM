"""Departments CRUD.

Departments are the canonical list of allowed values for the
`employees.department` string column. Renaming a department can
optionally cascade the new name to every matching employee row.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_admin
from app.db.session import get_db
from app.models.department import Department
from app.models.employee import Employee
from app.models.enums import AuditAction
from app.models.user import User
from app.schemas.common import MessageResponse
from app.schemas.department import (
    DepartmentCreate,
    DepartmentOut,
    DepartmentUpdate,
)
from app.services import audit

router = APIRouter(prefix="/departments", tags=["departments"])


async def _dept_with_count(db: AsyncSession, d: Department) -> DepartmentOut:
    count = (
        await db.execute(
            select(func.count()).select_from(Employee).where(
                Employee.department == d.name
            )
        )
    ).scalar_one()
    return DepartmentOut(
        id=d.id,
        name=d.name,
        description=d.description,
        employee_count=count,
    )


@router.get(
    "",
    response_model=list[DepartmentOut],
    summary="List departments (with headcount)",
)
async def list_departments(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[DepartmentOut]:
    items = (
        await db.execute(select(Department).order_by(Department.name))
    ).scalars().all()
    return [await _dept_with_count(db, d) for d in items]


@router.post(
    "",
    response_model=DepartmentOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a department (Admin)",
)
async def create_department(
    payload: DepartmentCreate,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_admin),
) -> DepartmentOut:
    existing = (
        await db.execute(select(Department).where(Department.name == payload.name))
    ).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Department name already exists")

    d = Department(name=payload.name.strip(), description=payload.description)
    db.add(d)
    await db.flush()
    await audit.record(
        db,
        actor_user_id=actor.id,
        action=AuditAction.ASSIGN_PROJECT,  # reused enum; department create
        entity_type="department",
        entity_id=d.id,
        detail=f"created {d.name}",
    )
    await db.commit()
    await db.refresh(d)
    return await _dept_with_count(db, d)


@router.patch(
    "/{department_id}",
    response_model=DepartmentOut,
    summary="Rename or update a department (Admin)",
)
async def update_department(
    department_id: int,
    payload: DepartmentUpdate,
    cascade: bool = Query(
        True,
        description="When renaming, also update the department string on every matching employee.",
    ),
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_admin),
) -> DepartmentOut:
    d = await db.get(Department, department_id)
    if d is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Department not found")

    changes = payload.model_dump(exclude_unset=True)
    old_name = d.name
    new_name = changes.get("name")

    if new_name and new_name != old_name:
        # Guard: refuse if the new name already exists on another row.
        clash = (
            await db.execute(
                select(Department).where(Department.name == new_name)
            )
        ).scalar_one_or_none()
        if clash is not None and clash.id != d.id:
            raise HTTPException(
                status.HTTP_409_CONFLICT, "Another department with that name exists"
            )

    for k, v in changes.items():
        setattr(d, k, v)

    cascaded = 0
    if cascade and new_name and new_name != old_name:
        result = await db.execute(
            Employee.__table__.update()
            .where(Employee.department == old_name)
            .values(department=new_name)
        )
        cascaded = result.rowcount or 0

    await db.flush()
    await audit.record(
        db,
        actor_user_id=actor.id,
        action=AuditAction.UPDATE_EMPLOYEE,
        entity_type="department",
        entity_id=d.id,
        detail=(
            f"renamed {old_name!r} -> {d.name!r}; cascaded {cascaded} employees"
            if new_name and new_name != old_name
            else f"updated {sorted(changes.keys())}"
        ),
    )
    await db.commit()
    await db.refresh(d)
    return await _dept_with_count(db, d)


@router.delete(
    "/{department_id}",
    response_model=MessageResponse,
    summary="Delete a department (Admin)",
)
async def delete_department(
    department_id: int,
    force: bool = Query(
        False,
        description="When false, refuses to delete if any employee still belongs to this department.",
    ),
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_admin),
) -> MessageResponse:
    d = await db.get(Department, department_id)
    if d is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Department not found")

    if not force:
        count = (
            await db.execute(
                select(func.count()).select_from(Employee).where(
                    Employee.department == d.name
                )
            )
        ).scalar_one()
        if count > 0:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                f"{count} employee(s) still belong to '{d.name}'. "
                "Reassign them first, or pass force=true to delete anyway.",
            )

    name = d.name
    await db.delete(d)
    await audit.record(
        db,
        actor_user_id=actor.id,
        action=AuditAction.UNASSIGN_PROJECT,  # reused enum; department delete
        entity_type="department",
        entity_id=department_id,
        detail=f"deleted {name}",
    )
    await db.commit()
    return MessageResponse(message=f"Deleted department '{name}'")
