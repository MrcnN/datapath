"""schemas/query_performance.py"""
from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class QueryStoreDatabaseInfo(BaseModel):
    name: str
    state: str


class QueryStoreOverview(BaseModel):
    enabled: bool
    readonly_reason: Optional[str] = None
    actual_state: Optional[str] = None
    max_plans_per_query: Optional[int] = None
    query_capture_mode: Optional[str] = None
    current_storage_size_mb: Optional[float] = None
    max_storage_size_mb: Optional[float] = None
    databases_with_qs: List[QueryStoreDatabaseInfo] = []


class ExpensiveQuery(BaseModel):
    query_id: Optional[int] = None
    query_hash: Optional[str] = None
    query_text_snippet: Optional[str] = None
    plan_id: Optional[int] = None
    avg_cpu_ms: Optional[float] = None
    avg_duration_ms: Optional[float] = None
    avg_logical_reads: Optional[float] = None
    execution_count: Optional[int] = None
    total_cpu_ms: Optional[float] = None
    first_seen: Optional[datetime] = None
    last_seen: Optional[datetime] = None
    is_regressed: bool = False


class RegressionResult(BaseModel):
    query_id: Optional[int] = None
    query_text_snippet: Optional[str] = None
    old_avg_cpu_ms: Optional[float] = None
    new_avg_cpu_ms: Optional[float] = None
    cpu_delta_pct: Optional[float] = None
    old_avg_duration_ms: Optional[float] = None
    new_avg_duration_ms: Optional[float] = None
    duration_delta_pct: Optional[float] = None
    old_execution_count: Optional[int] = None
    new_execution_count: Optional[int] = None


class PlanWarningQuery(BaseModel):
    plan_handle: str
    query_hash: Optional[str] = None
    database_name: str
    query_text: str
    warning_type: str
    warning_severity: str
    warning_details: str
    recommendation: str
    execution_count: int
    total_cpu_ms: float
    avg_cpu_ms: float
    total_logical_reads: int
    avg_logical_reads: float
    max_grant_kb: Optional[int] = None
    last_execution_time: Optional[str] = None


class PlanAntiPatternsSummary(BaseModel):
    is_demo: bool = False
    total_flagged_plans: int
    spill_count: int
    implicit_conversion_count: int
    missing_index_count: int
    high_grant_count: int
    queries: List[PlanWarningQuery] = []

