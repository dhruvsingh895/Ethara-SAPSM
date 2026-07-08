"""Auth-related Pydantic schemas."""

from __future__ import annotations

from pydantic import BaseModel

from app.models.enums import UserRole


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: "UserPublic"


class UserPublic(BaseModel):
    id: int
    username: str
    email: str
    role: UserRole
    is_active: bool
    employee_id: int | None = None

    model_config = {"from_attributes": True}


TokenResponse.model_rebuild()
