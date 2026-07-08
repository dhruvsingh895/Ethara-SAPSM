"""API v1 aggregate router.

Individual resource routers will be attached here as they are built
in later phases (employees, seats, projects, allocations, AI, etc.).
"""

from __future__ import annotations

from fastapi import APIRouter

from app.api.v1.endpoints import (
    allocations,
    auth,
    dashboard,
    employees,
    health,
    new_joiner,
    projects,
    seats,
)

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router)
api_router.include_router(employees.router)
api_router.include_router(seats.router)
api_router.include_router(projects.router)
api_router.include_router(allocations.router)
api_router.include_router(new_joiner.router)
api_router.include_router(dashboard.router)
