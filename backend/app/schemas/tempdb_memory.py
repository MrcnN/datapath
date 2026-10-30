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


class BufferPoolDatabaseUsage(BaseModel):
    database_name: str
    buffer_pool_mb: float
    percentage_of_buffer_pool: float
    dirty_pages_mb: float
    clean_pages_mb: float
    total_pages_count: int


class BufferPoolTopObject(BaseModel):
    database_name: str
    schema_name: str
    table_name: str
    index_name: Optional[str] = None
    index_type: str
    buffer_mb: float
    page_count: int


class PlanCacheBloatAnalysis(BaseModel):
    total_cached_plans_count: int
    single_use_plans_count: int
    single_use_plans_percent: float
    total_cache_size_mb: float
    wasted_adhoc_mb: float
    wasted_memory_percent: float
    status: str  # 'HEALTHY' (<15%), 'WARNING' (15-30%), 'CRITICAL' (>30%)
    optimize_for_adhoc_enabled: bool
    recommendation: str
    remediation_script: str


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

    # Buffer Pool Deep Distribution & Ad-Hoc Plan Bloat
    buffer_pool_db_distribution: List[BufferPoolDatabaseUsage] = []
    buffer_pool_top_objects: List[BufferPoolTopObject] = []
    plan_cache_bloat: Optional[PlanCacheBloatAnalysis] = None

    is_demo: bool = False


class QueryMemoryGrantDetail(BaseModel):
    session_id: int
    request_id: int
    scheduler_id: int
    dop: int
    request_time: str
    grant_time: Optional[str] = None
    requested_memory_mb: float
    granted_memory_mb: float
    required_memory_mb: float
    used_memory_mb: float
    max_used_memory_mb: float
    ideal_memory_mb: float
    is_waiting: bool
    wait_time_ms: int
    resource_semaphore_id: int
    query_text: str
    waste_ratio_percent: float


class MemoryGrantsSummary(BaseModel):
    total_grant_count: int
    waiting_grant_count: int
    total_granted_mb: float
    total_requested_mb: float
    semaphore_pressure: str  # "HEALTHY" | "PRESSURE_DETECTED" | "CRITICAL_STARVATION"
    grants: List[QueryMemoryGrantDetail] = []
    is_demo: bool = False


