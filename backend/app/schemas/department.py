"""Department request/response schemas."""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class DepartmentBase(BaseModel):
    name: str = Field(min_length=1, max_length=64)
    description: Optional[str] = Field(default=None, max_length=255)


class DepartmentCreate(DepartmentBase):
    pass


class DepartmentUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=64)
    description: Optional[str] = Field(default=None, max_length=255)


class DepartmentOut(DepartmentBase):
    id: int
    employee_count: int = 0

    model_config = {"from_attributes": True}
