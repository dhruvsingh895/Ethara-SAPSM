"""Enum types used across the domain."""

from __future__ import annotations

from enum import Enum


class UserRole(str, Enum):
    ADMIN = "admin"
    HR = "hr"
    PM = "pm"
    EMPLOYEE = "employee"


class EmployeeStatus(str, Enum):
    ACTIVE = "active"
    ON_LEAVE = "on_leave"
    EXITED = "exited"


class SeatStatus(str, Enum):
    AVAILABLE = "available"
    OCCUPIED = "occupied"
    RESERVED = "reserved"
    # Spec uses "maintenance"; keeping the enum value string aligned with the
    # spec so API consumers see the exact wording the assessment expects.
    MAINTENANCE = "maintenance"


class ProjectStatus(str, Enum):
    ACTIVE = "active"
    ON_HOLD = "on_hold"
    COMPLETED = "completed"


class AuditAction(str, Enum):
    ALLOCATE = "allocate"
    RELEASE = "release"
    TRANSFER = "transfer"
    MAINTENANCE = "maintenance"
    RESERVE = "reserve"
    ASSIGN_PROJECT = "assign_project"
    UNASSIGN_PROJECT = "unassign_project"
    CREATE_EMPLOYEE = "create_employee"
    UPDATE_EMPLOYEE = "update_employee"
    CHANGE_ROLE = "change_role"
