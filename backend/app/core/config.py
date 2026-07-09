"""Application configuration loaded from environment variables."""

from __future__ import annotations

from functools import lru_cache
from typing import List

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Typed application settings.

    Values are read from environment variables and, in development,
    from a local `.env` file. In production (Render), env vars are
    injected by the platform.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # --- App ---
    environment: str = "development"
    app_name: str = "Ethara SAPSM"
    api_v1_prefix: str = "/api/v1"
    log_level: str = "INFO"

    # --- Server ---
    host: str = "0.0.0.0"
    port: int = 8000

    # --- CORS ---
    cors_origins: str = "http://localhost:3000"

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    # --- DB ---
    database_url: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5432/ethara",
        description="Async SQLAlchemy URL used by the app.",
    )
    database_url_sync: str = Field(
        default="postgresql+psycopg2://postgres:postgres@localhost:5432/ethara",
        description="Sync URL for Alembic migrations.",
    )
    ai_reader_database_url: str = Field(
        default="postgresql+asyncpg://ai_reader:changeme@localhost:5432/ethara",
        description="SELECT-only role used by the NL-to-SQL assistant.",
    )

    # --- JWT ---
    jwt_secret: str = "CHANGE_ME"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 7

    # --- Gemini ---
    # `gemini_api_key` accepts either a single key or a comma-separated
    # list. The service tries them in order and falls over to the next
    # on 429 / 5xx / auth errors so a single revoked or rate-limited
    # key doesn't take the assistant down.
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"

    @property
    def gemini_api_keys_list(self) -> List[str]:
        return [k.strip() for k in self.gemini_api_key.split(",") if k.strip()]

    # --- Seed ---
    seed_scale: str = "full"
    seed_demo_password: str = "demo1234"

    @field_validator("environment")
    @classmethod
    def _normalize_env(cls, v: str) -> str:
        return v.lower().strip()


@lru_cache
def get_settings() -> Settings:
    return Settings()
