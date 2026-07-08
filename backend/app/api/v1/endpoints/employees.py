"""Employees CRUD."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_hr_or_admin
from app.db.session import get_db
from app.models.employee import Employee
from app.models.enums import AuditAction, EmployeeStatus
from app.models.user import User
from app.schemas.common import MessageResponse, Page, PageParams
from app.schemas.employee import EmployeeCreate, EmployeeOut, EmployeeUpdate
from app.services import audit

router = APIRouter(prefix="/employees", tags=["employees"])


@router.get("", response_model=Page[EmployeeOut], summary="List employees")
async def list_employees(
    page: PageParams = Depends(),
    q: Optional[str] = Query(None, description="Search across name, emp_code, email"),
    department: Optional[str] = Query(None),
    status_: Optional[EmployeeStatus] = Query(None, alias="status"),
    project_id: Optional[int] = Query(None),
    seat_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> Page[EmployeeOut]:
    stmt = select(Employee)
    count_stmt = select(func.count()).select_from(Employee)

    filters = []
    if q:
        like = f"%{q.strip()}%"
        filters.append(
            or_(
                Employee.first_name.ilike(like),
                Employee.last_name.ilike(like),
                Employee.email.ilike(like),
                Employee.emp_code.ilike(like),
            )
        )
    if department:
        filters.append(Employee.department == department)
    if status_:
        filters.append(Employee.status == status_)
    if project_id is not None:
        filters.append(Employee.current_project_id == project_id)
    if seat_id is not None:
        filters.append(Employee.current_seat_id == seat_id)

    for f in filters:
        stmt = stmt.where(f)
        count_stmt = count_stmt.where(f)

    total = (await db.execute(count_stmt)).scalar_one()
    stmt = stmt.order_by(Employee.id).limit(page.limit).offset(page.offset)
    items = (await db.execute(stmt)).scalars().all()

    return Page[EmployeeOut](
        items=[EmployeeOut.model_validate(e) for e in items],
        total=total,
        limit=page.limit,
        offset=page.offset,
    )


@router.get("/{employee_id}", response_model=EmployeeOut, summary="Get employee by id")
async def get_employee(
    employee_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> EmployeeOut:
    emp = await db.get(Employee, employee_id)
    if emp is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Employee not found")
    return EmployeeOut.model_validate(emp)


@router.post(
    "",
    response_model=EmployeeOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create employee (HR/Admin)",
)
async def create_employee(
    payload: EmployeeCreate,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_hr_or_admin),
) -> EmployeeOut:
    existing = (
        await db.execute(
            select(Employee).where(
                or_(Employee.emp_code == payload.emp_code, Employee.email == payload.email)
            )
        )
    ).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Employee with this emp_code or email already exists"
        )

    emp = Employee(**payload.model_dump())
    db.add(emp)
    await db.flush()
    await audit.record(
        db,
        actor_user_id=actor.id,
        action=AuditAction.CREATE_EMPLOYEE,
        entity_type="employee",
        entity_id=emp.id,
        detail=f"{emp.emp_code} {emp.full_name}",
    )
    await db.commit()
    await db.refresh(emp)
    return EmployeeOut.model_validate(emp)


@router.patch(
    "/{employee_id}",
    response_model=EmployeeOut,
    summary="Update employee (HR/Admin)",
)
async def update_employee(
    employee_id: int,
    payload: EmployeeUpdate,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_hr_or_admin),
) -> EmployeeOut:
    emp = await db.get(Employee, employee_id)
    if emp is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Employee not found")

    changes = payload.model_dump(exclude_unset=True)
    for k, v in changes.items():
        setattr(emp, k, v)

    await db.flush()
    await audit.record(
        db,
        actor_user_id=actor.id,
        action=AuditAction.UPDATE_EMPLOYEE,
        entity_type="employee",
        entity_id=emp.id,
        detail=",".join(sorted(changes.keys())),
    )
    await db.commit()
    await db.refresh(emp)
    return EmployeeOut.model_validate(emp)


@router.delete(
    "/{employee_id}",
    response_model=MessageResponse,
    summary="Delete employee (HR/Admin)",
)
async def delete_employee(
    employee_id: int,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_hr_or_admin),
) -> MessageResponse:
    emp = await db.get(Employee, employee_id)
    if emp is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Employee not found")
    detail = f"{emp.emp_code} {emp.full_name}"
    await db.delete(emp)
    await audit.record(
        db,
        actor_user_id=actor.id,
        action=AuditAction.UPDATE_EMPLOYEE,
        entity_type="employee",
        entity_id=employee_id,
        detail=f"deleted {detail}",
    )
    await db.commit()
    return MessageResponse(message="Employee deleted")
