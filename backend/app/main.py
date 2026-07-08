"""FastAPI application entry point."""

from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import get_settings

settings = get_settings()

logging.basicConfig(
    level=settings.log_level,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
log = logging.getLogger("ethara")


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        description=(
            "Seat Allocation and Project Mapping System for ~5,000 employees. "
            "Manages employees, projects, seats, allocations, dashboards, and "
            "a natural-language query assistant."
        ),
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(api_router, prefix=settings.api_v1_prefix)

    @app.get("/", tags=["root"], summary="Service info")
    async def root() -> dict[str, str]:
        return {
            "name": settings.app_name,
            "version": "0.1.0",
            "docs": "/docs",
            "openapi": "/openapi.json",
        }

    log.info("app.startup env=%s", settings.environment)
    return app


app = create_app()
