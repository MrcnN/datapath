"""schemas/wait_stats.py — Data models for SQL Server Wait Statistics and CPU Pressure analysis."""
from __future__ import annotations

from typing import List, Optional
from pydantic import BaseModel


class WaitStatEntry(BaseModel):
    wait_type: str
    category: str
    waiting_tasks_count: int
    wait_time_ms: float
    wait_time_sec: float
    max_wait_time_ms: float
    signal_wait_time_ms: float
    signal_wait_percent: float
    resource_wait_ms: float
    percentage_of_total: float
    description: str
    recommendation: str


class CategoryWaitSummary(BaseModel):
    category: str
    total_wait_ms: float
    percentage: float
    wait_count: int


class WaitStatsSummary(BaseModel):
    total_wait_time_ms: float
    total_signal_wait_ms: float
    signal_wait_ratio_percent: float
    has_cpu_pressure: bool
    top_category: str
    total_waiting_tasks: int
    categories: List[CategoryWaitSummary] = []
    wait_stats: List[WaitStatEntry] = []
    is_demo: bool = False
