"""Employee request/response schemas."""

from __future__ import annotations

from datetime import date
from typing import Optional

from pydantic import BaseModel, EmailStr, Field

from app.models.enums import EmployeeStatus


class EmployeeBase(BaseModel):
    first_name: str = Field(min_length=1, max_length=64)
    last_name: str = Field(min_length=1, max_length=64)
    email: EmailStr
    phone: Optional[str] = Field(default=None, max_length=32)
    designation: str = Field(min_length=1, max_length=80)
    department: str = Field(min_length=1, max_length=64)
    joining_date: date
    exit_date: Optional[date] = None
    status: EmployeeStatus = EmployeeStatus.ACTIVE
    manager_id: Optional[int] = None


class EmployeeCreate(EmployeeBase):
    emp_code: str = Field(min_length=1, max_length=16)


class EmployeeUpdate(BaseModel):
    first_name: Optional[str] = Field(default=None, min_length=1, max_length=64)
    last_name: Optional[str] = Field(default=None, min_length=1, max_length=64)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(default=None, max_length=32)
    designation: Optional[str] = Field(default=None, min_length=1, max_length=80)
    department: Optional[str] = Field(default=None, min_length=1, max_length=64)
    joining_date: Optional[date] = None
    exit_date: Optional[date] = None
    status: Optional[EmployeeStatus] = None
    manager_id: Optional[int] = None


class EmployeeOut(EmployeeBase):
    id: int
    emp_code: str
    current_seat_id: Optional[int] = None
    current_project_id: Optional[int] = None

    model_config = {"from_attributes": True}
