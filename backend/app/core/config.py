"""core/config.py — Application settings loaded from environment / .env file."""
from __future__ import annotations

import logging
from typing import List

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    """Datapath application settings.

    All credential fields are intentionally excluded from logging.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # --- Database ---
    DB_SERVER: str = "localhost"
    DB_DATABASE: str = "master"
    DB_USERNAME: str = ""
    DB_PASSWORD: str = ""
    DB_TRUSTED_CONNECTION: bool = False
    DB_DRIVER: str = "ODBC Driver 17 for SQL Server"
    DB_TIMEOUT: int = 30

    # --- CORS ---
    ALLOWED_ORIGINS: str = "http://localhost:5173"

    # --- App ---
    APP_VERSION: str = "0.1.0"
    LOG_LEVEL: str = "INFO"

    @field_validator("DB_TIMEOUT", mode="before")
    @classmethod
    def validate_timeout(cls, v: int) -> int:
        v = int(v)
        if v < 1 or v > 300:
            raise ValueError("DB_TIMEOUT must be between 1 and 300 seconds")
        return v

    def get_allowed_origins(self) -> List[str]:
        """Parse comma-separated ALLOWED_ORIGINS into a list."""
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]

    def safe_dict(self) -> dict:
        """Return settings dict with credentials redacted — safe for logging."""
        d = self.model_dump()
        d["DB_PASSWORD"] = "***REDACTED***" if self.DB_PASSWORD else ""
        d["DB_USERNAME"] = "***REDACTED***" if self.DB_USERNAME else ""
        return d


settings = Settings()
