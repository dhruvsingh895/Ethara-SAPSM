"""Shared response schemas and pagination helpers."""

from __future__ import annotations

from typing import Generic, List, TypeVar

from fastapi import Query
from pydantic import BaseModel

T = TypeVar("T")


class Page(BaseModel, Generic[T]):
    """Standard paginated list response."""

    items: List[T]
    total: int
    limit: int
    offset: int


class PageParams:
    """FastAPI dependency for pagination query params."""

    def __init__(
        self,
        limit: int = Query(50, ge=1, le=200, description="Max rows to return"),
        offset: int = Query(0, ge=0, description="Rows to skip"),
    ):
        self.limit = limit
        self.offset = offset


class MessageResponse(BaseModel):
    message: str
