"""schemas/tempdb_memory.py — Data models for TempDB allocation, contention, and Buffer Pool / Memory Intelligence."""
from __future__ import annotations

from typing import List, Optional
from pydantic import BaseModel


class TempDBSpaceBreakdown(BaseModel):
    user_objects_mb: float
    internal_objects_mb: float
    version_store_mb: float
    unallocated_space_mb: float
    total_size_mb: float
    user_objects_pct: float
    internal_objects_pct: float
    version_store_pct: float
    unallocated_pct: float


class TempDBFile(BaseModel):
    file_id: int
    name: str
    physical_name: str
    size_mb: float
    free_mb: float
    free_percent: float
    growth: str
    is_percent_growth: bool


class MemoryClerk(BaseModel):
    clerk_type: str
    friendly_name: str
    size_mb: float
    percentage_of_total: float


class TempDBMemorySummary(BaseModel):
    # TempDB
    space_breakdown: TempDBSpaceBreakdown
    tempdb_files: List[TempDBFile] = []
    file_count: int
    cpu_cores: int
    sizing_equal: bool
    file_count_status: str  # "OPTIMAL", "WARNING"
    file_count_recommendation: str
    allocation_contention_detected: bool
    contention_description: str

    # Memory / Buffer Pool
    page_life_expectancy_sec: int
    ple_status: str  # "HEALTHY", "WARNING", "CRITICAL"
    ple_recommendation: str
    buffer_cache_hit_ratio: float
    total_server_memory_mb: float
    target_server_memory_mb: float
    memory_utilization_pct: float
    top_memory_clerks: List[MemoryClerk] = []

    is_demo: bool = False
