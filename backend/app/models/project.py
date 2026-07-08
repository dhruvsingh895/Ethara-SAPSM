"""Project model."""

from __future__ import annotations

from datetime import date
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import Date, Enum as SAEnum, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import ProjectStatus
from app.models.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.employee import Employee
    from app.models.project_assignment import ProjectAssignment


class Project(Base, TimestampMixin):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(16), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(120), unique=True, index=True, nullable=False)
    client: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    status: Mapped[ProjectStatus] = mapped_column(
        SAEnum(ProjectStatus, name="project_status", native_enum=False, length=32),
        nullable=False,
        default=ProjectStatus.ACTIVE,
        index=True,
    )

    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    required_seats: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    pm_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("employees.id", ondelete="SET NULL", use_alter=True),
        nullable=True,
        index=True,
    )
    pm: Mapped[Optional["Employee"]] = relationship(foreign_keys=[pm_id])

    assignments: Mapped[List["ProjectAssignment"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
    primary_members: Mapped[List["Employee"]] = relationship(
        back_populates="current_project",
        foreign_keys="Employee.current_project_id",
    )

    def __repr__(self) -> str:
        return f"<Project {self.code} {self.name!r}>"
