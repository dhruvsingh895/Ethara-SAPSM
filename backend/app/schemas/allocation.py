"""Seat allocation request/response schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class AllocationCreate(BaseModel):
    seat_id: int
    employee_id: int
    note: Optional[str] = Field(default=None, max_length=255)


class AllocationRelease(BaseModel):
    note: Optional[str] = Field(default=None, max_length=255)


class AllocationTransfer(BaseModel):
    employee_id: int
    new_seat_id: int
    note: Optional[str] = Field(default=None, max_length=255)


class AllocationOut(BaseModel):
    id: int
    seat_id: int
    employee_id: int
    allocated_at: datetime
    released_at: Optional[datetime] = None
    allocated_by_id: Optional[int] = None
    released_by_id: Optional[int] = None
    note: Optional[str] = None

    model_config = {"from_attributes": True}
