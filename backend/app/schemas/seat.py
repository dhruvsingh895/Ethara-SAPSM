"""Seat request/response schemas."""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field

from app.models.enums import SeatStatus


class SeatBase(BaseModel):
    building: str = Field(min_length=1, max_length=16)
    floor: int = Field(ge=0)
    zone: str = Field(min_length=1, max_length=16)
    bay: Optional[str] = Field(default=None, min_length=1, max_length=16)
    seat_number: int = Field(ge=1)
    status: SeatStatus = SeatStatus.AVAILABLE
    notes: Optional[str] = Field(default=None, max_length=255)


class SeatCreate(SeatBase):
    seat_code: str = Field(min_length=1, max_length=32)


class SeatUpdate(BaseModel):
    building: Optional[str] = Field(default=None, min_length=1, max_length=16)
    floor: Optional[int] = Field(default=None, ge=0)
    zone: Optional[str] = Field(default=None, min_length=1, max_length=16)
    bay: Optional[str] = Field(default=None, min_length=1, max_length=16)
    seat_number: Optional[int] = Field(default=None, ge=1)
    status: Optional[SeatStatus] = None
    notes: Optional[str] = Field(default=None, max_length=255)


class SeatOut(SeatBase):
    id: int
    seat_code: str

    model_config = {"from_attributes": True}
