"""Dashboard aggregate response schemas."""

from __future__ import annotations

from pydantic import BaseModel


class SeatStatusCount(BaseModel):
    status: str
    count: int


class OccupancySummary(BaseModel):
    total_seats: int
    available: int
    occupied: int
    reserved: int
    # Spec calls this "Maintenance"; keeping both keys so old frontend
    # code that reads `blocked` still works during the rename window.
    maintenance: int
    blocked: int = 0
    occupancy_pct: float


class FloorOccupancy(BaseModel):
    building: str
    floor: int
    total: int
    occupied: int
    available: int
    occupancy_pct: float


class ProjectUtilization(BaseModel):
    project_id: int
    project_code: str
    project_name: str
    active_members: int
    required_seats: int
    # utilization_pct is capped at 100.0 so charts and progress bars
    # never look absurd. When a project is staffed above its plan,
    # over_by carries the surplus for a separate warning badge.
    utilization_pct: float
    over_by: int = 0


class HeadcountByDept(BaseModel):
    department: str
    active: int


class OverviewResponse(BaseModel):
    occupancy: OccupancySummary
    active_employees: int
    joiners_last_30_days: int
    active_projects: int
    top_departments: list[HeadcountByDept]
