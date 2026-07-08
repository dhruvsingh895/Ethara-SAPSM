"""SQLAlchemy ORM models.

Importing this package registers all models on `Base.metadata`, which
Alembic autogenerate needs.
"""

from app.models.ai_query_log import AiQueryLog
from app.models.audit_log import AuditLog
from app.models.employee import Employee
from app.models.enums import (
    AuditAction,
    EmployeeStatus,
    ProjectStatus,
    SeatStatus,
    UserRole,
)
from app.models.project import Project
from app.models.project_assignment import ProjectAssignment
from app.models.seat import Seat
from app.models.seat_allocation import SeatAllocation
from app.models.user import User

__all__ = [
    "AiQueryLog",
    "AuditAction",
    "AuditLog",
    "Employee",
    "EmployeeStatus",
    "Project",
    "ProjectAssignment",
    "ProjectStatus",
    "Seat",
    "SeatAllocation",
    "SeatStatus",
    "User",
    "UserRole",
]
