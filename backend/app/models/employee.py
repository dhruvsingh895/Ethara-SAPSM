"""Employee model — the core entity."""

from __future__ import annotations

from datetime import date
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import Date, Enum as SAEnum, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import EmployeeStatus
from app.models.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.project import Project
    from app.models.project_assignment import ProjectAssignment
    from app.models.seat import Seat
    from app.models.seat_allocation import SeatAllocation
    from app.models.user import User


class Employee(Base, TimestampMixin):
    __tablename__ = "employees"
    __table_args__ = (
        Index("ix_employees_dept_status", "department", "status"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    emp_code: Mapped[str] = mapped_column(String(16), unique=True, index=True, nullable=False)

    first_name: Mapped[str] = mapped_column(String(64), nullable=False)
    last_name: Mapped[str] = mapped_column(String(64), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    phone: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)

    designation: Mapped[str] = mapped_column(String(80), nullable=False)
    department: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    joining_date: Mapped[date] = mapped_column(Date, nullable=False)
    exit_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    status: Mapped[EmployeeStatus] = mapped_column(
        SAEnum(EmployeeStatus, name="employee_status", native_enum=False, length=32),
        nullable=False,
        default=EmployeeStatus.ACTIVE,
        index=True,
    )

    manager_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("employees.id", ondelete="SET NULL"), nullable=True, index=True
    )
    manager: Mapped[Optional["Employee"]] = relationship(
        remote_side="Employee.id", back_populates="reports"
    )
    reports: Mapped[List["Employee"]] = relationship(back_populates="manager")

    current_seat_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("seats.id", ondelete="SET NULL", use_alter=True),
        nullable=True,
        index=True,
    )
    current_seat: Mapped[Optional["Seat"]] = relationship(
        back_populates="current_occupant",
        foreign_keys=[current_seat_id],
    )

    current_project_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("projects.id", ondelete="SET NULL", use_alter=True),
        nullable=True,
        index=True,
    )
    current_project: Mapped[Optional["Project"]] = relationship(
        back_populates="primary_members",
        foreign_keys=[current_project_id],
    )

    user: Mapped[Optional["User"]] = relationship(back_populates="employee", uselist=False)
    project_assignments: Mapped[List["ProjectAssignment"]] = relationship(
        back_populates="employee", cascade="all, delete-orphan"
    )
    seat_allocations: Mapped[List["SeatAllocation"]] = relationship(
        back_populates="employee",
        cascade="all, delete-orphan",
        foreign_keys="SeatAllocation.employee_id",
    )

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}".strip()

    def __repr__(self) -> str:
        return f"<Employee {self.emp_code} {self.full_name}>"
