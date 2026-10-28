"""schemas/connections.py"""
from __future__ import annotations

from typing import Optional
from pydantic import BaseModel, Field, model_validator


class ConnectionTestRequest(BaseModel):
    server: str = Field(..., min_length=1, description="SQL Server hostname or IP")
    database: str = Field(default="master", min_length=1)
    username: Optional[str] = Field(default=None)
    password: Optional[str] = Field(default=None)
    trusted_connection: bool = Field(default=False)
    use_windows_auth: Optional[bool] = Field(default=None)
    driver: str = Field(default="ODBC Driver 17 for SQL Server")
    timeout: int = Field(default=30, ge=1, le=300)

    @model_validator(mode="after")
    def sync_windows_auth(self) -> ConnectionTestRequest:
        if self.use_windows_auth is not None:
            self.trusted_connection = self.use_windows_auth
        return self


class ServerInfo(BaseModel):
    version: Optional[str] = None
    edition: Optional[str] = None
    product_level: Optional[str] = None
    product_version: Optional[str] = None
    server_name: Optional[str] = None
    collation: Optional[str] = None


class ConnectionTestResponse(BaseModel):
    success: bool
    message: str
    server_info: Optional[ServerInfo] = None
