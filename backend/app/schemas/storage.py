"""schemas/storage.py — Data models for database files, log space, and autogrowth tracking."""
from __future__ import annotations

from typing import List, Optional
from pydantic import BaseModel


class DatabaseFile(BaseModel):
    database_name: str
    file_id: int
    name: str
    file_type: str  # ROWS / LOG
    physical_name: str
    size_mb: float
    used_mb: float
    free_mb: float
    free_percent: float
    growth: str
    is_percent_growth: bool
    max_size: str
    growth_recommendation_sql: Optional[str] = None


class LogSpaceUsage(BaseModel):
    database_name: str
    log_size_mb: float
    log_space_used_percent: float
    status: int
    log_reuse_wait_desc: str


class AutogrowthEvent(BaseModel):
    start_time: str
    database_name: str
    file_name: str
    file_type: str
    growth_mb: float
    duration_ms: float


class StorageSummary(BaseModel):
    total_data_size_mb: float
    total_log_size_mb: float
    total_free_space_mb: float
    files_with_percent_growth_count: int
    high_log_usage_dbs_count: int
    files: List[DatabaseFile] = []
    log_spaces: List[LogSpaceUsage] = []
    autogrowth_events: List[AutogrowthEvent] = []
    is_demo: bool = False
