"""AI assistant request/response schemas."""

from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field


class AiQueryRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=1000)


class AiQueryResponse(BaseModel):
    prompt: str
    sql: Optional[str] = None
    columns: list[str] = []
    rows: list[list[Any]] = []
    status: str  # ok | rejected | gemini_error | exec_error | unavailable
    error: Optional[str] = None
    duration_ms: int
