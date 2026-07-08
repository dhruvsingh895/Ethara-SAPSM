"""Project assignment schemas."""

from __future__ import annotations

from datetime import date
from typing import Optional

from pydantic import BaseModel, Field


class ProjectAssignmentBase(BaseModel):
    employee_id: int
    project_id: int
    role: str = Field(min_length=1, max_length=80)
    allocation_pct: int = Field(ge=0, le=100, default=100)
    start_date: date
    end_date: Optional[date] = None


class ProjectAssignmentCreate(ProjectAssignmentBase):
    pass


class ProjectAssignmentUpdate(BaseModel):
    role: Optional[str] = Field(default=None, min_length=1, max_length=80)
    allocation_pct: Optional[int] = Field(default=None, ge=0, le=100)
    end_date: Optional[date] = None


class ProjectAssignmentOut(ProjectAssignmentBase):
    id: int

    model_config = {"from_attributes": True}
