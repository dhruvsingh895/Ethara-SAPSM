"""API v1 aggregate router.

Individual resource routers will be attached here as they are built
in later phases (employees, seats, projects, allocations, AI, etc.).
"""

from __future__ import annotations

from fastapi import APIRouter

from app.api.v1.endpoints import health

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
