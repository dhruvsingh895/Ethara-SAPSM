"""User-management schemas (admin-only)."""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field

from app.models.enums import UserRole


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=8, max_length=128)
    role: UserRole
    employee_id: Optional[int] = None


class UserUpdate(BaseModel):
    email: Optional[str] = Field(default=None, min_length=3, max_length=255)
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None
    password: Optional[str] = Field(default=None, min_length=8, max_length=128)
    employee_id: Optional[int] = None
