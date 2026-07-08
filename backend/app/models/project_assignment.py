"""Many-to-many between employees and projects with allocation %."""

from __future__ import annotations

from datetime import date
from typing import TYPE_CHECKING, Optional

from sqlalchemy import (
    CheckConstraint,
    Date,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.employee import Employee
    from app.models.project import Project


class ProjectAssignment(Base, TimestampMixin):
    __tablename__ = "project_assignments"
    __table_args__ = (
        UniqueConstraint(
            "employee_id", "project_id", "start_date",
            name="uq_assignment_emp_proj_start",
        ),
        CheckConstraint("allocation_pct BETWEEN 0 AND 100", name="allocation_range"),
        Index("ix_pa_active", "employee_id", "end_date"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)

    employee_id: Mapped[int] = mapped_column(
        ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True
    )
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )

    role: Mapped[str] = mapped_column(String(80), nullable=False)
    allocation_pct: Mapped[int] = mapped_column(Integer, nullable=False, default=100)

    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    employee: Mapped["Employee"] = relationship(back_populates="project_assignments")
    project: Mapped["Project"] = relationship(back_populates="assignments")

    def __repr__(self) -> str:
        return (
            f"<ProjectAssignment emp={self.employee_id} proj={self.project_id} "
            f"{self.allocation_pct}%>"
        )
