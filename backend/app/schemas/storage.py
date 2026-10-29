"""schemas/storage.py — Data models for database files, log space, autogrowth tracking, and Virtual File Stats (Disk Latency)."""
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


class FileIOLatency(BaseModel):
    database_name: str
    file_name: str
    file_type: str
    physical_name: str
    drive_letter: str
    read_latency_ms: float
    write_latency_ms: float
    overall_latency_ms: float
    num_of_reads: int
    num_of_writes: int
    io_stall_ms: float
    status: str  # "EXCELLENT", "NORMAL", "WARNING", "CRITICAL"


class DriveIOSummary(BaseModel):
    drive_letter: str
    avg_read_latency_ms: float
    avg_write_latency_ms: float
    total_reads: int
    total_writes: int
    status: str  # "EXCELLENT", "NORMAL", "WARNING", "CRITICAL"
    file_count: int


class GrowthHistoryPoint(BaseModel):
    date: str
    size_mb: float


class DatabaseGrowthForecast(BaseModel):
    database_name: str
    current_size_mb: float
    size_30_days_ago_mb: Optional[float] = None
    size_60_days_ago_mb: Optional[float] = None
    size_90_days_ago_mb: Optional[float] = None
    growth_last_30_days_mb: float
    growth_percent_30_days: float
    daily_growth_mb: float
    projected_size_90_days_mb: float
    drive_letter: str
    drive_free_space_mb: float
    days_until_disk_full: Optional[int] = None
    status: str  # 'CRITICAL_CAPACITY', 'RAPID_GROWTH', 'MODERATE', 'STABLE'
    history_points: List[GrowthHistoryPoint] = []


class StorageSummary(BaseModel):
    total_data_size_mb: float
    total_log_size_mb: float
    total_free_space_mb: float
    files_with_percent_growth_count: int
    high_log_usage_dbs_count: int
    critical_io_files_count: int = 0
    files: List[DatabaseFile] = []
    log_spaces: List[LogSpaceUsage] = []
    autogrowth_events: List[AutogrowthEvent] = []
    file_io_latencies: List[FileIOLatency] = []
    drive_io_summaries: List[DriveIOSummary] = []
    growth_forecasts: List[DatabaseGrowthForecast] = []
    fastest_growing_db: Optional[str] = None
    total_30_day_growth_mb: float = 0.0
    min_disk_runway_days: Optional[int] = None
    is_demo: bool = False

