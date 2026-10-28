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
