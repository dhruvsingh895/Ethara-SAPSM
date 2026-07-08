"""Project request/response schemas."""

from __future__ import annotations

from datetime import date
from typing import Optional

from pydantic import BaseModel, Field

from app.models.enums import ProjectStatus


class ProjectBase(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    client: str = Field(min_length=1, max_length=120)
    description: Optional[str] = Field(default=None, max_length=500)
    status: ProjectStatus = ProjectStatus.ACTIVE
    start_date: date
    end_date: Optional[date] = None
    required_seats: int = Field(ge=0, default=0)
    pm_id: Optional[int] = None


class ProjectCreate(ProjectBase):
    code: str = Field(min_length=1, max_length=16)


class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    client: Optional[str] = Field(default=None, min_length=1, max_length=120)
    description: Optional[str] = Field(default=None, max_length=500)
    status: Optional[ProjectStatus] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    required_seats: Optional[int] = Field(default=None, ge=0)
    pm_id: Optional[int] = None


class ProjectOut(ProjectBase):
    id: int
    code: str

    model_config = {"from_attributes": True}
