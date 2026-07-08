"""AI assistant request/response schemas."""

from __future__ import annotations

from datetime import datetime
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


class AiHistoryEntry(BaseModel):
    """A single logged NL query, no result rows.

    Rows are not persisted (only counts) so we can't return the original
    result set — only the prompt, the SQL, and metadata.
    """

    id: int
    at: datetime
    prompt: str
    generated_sql: Optional[str] = None
    rows_returned: Optional[int] = None
    duration_ms: Optional[int] = None
    status: str
    error: Optional[str] = None

    model_config = {"from_attributes": True}
