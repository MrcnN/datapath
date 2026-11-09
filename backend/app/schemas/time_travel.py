"""schemas/time_travel.py — Pydantic models for Workload Time-Travel Correlator & Spike Detective."""
from __future__ import annotations

from typing import List, Optional, Literal
from pydantic import BaseModel, Field


class CorrelatedQueryItem(BaseModel):
    query_id: int
    plan_id: int
    query_text: str
    cpu_time_ms: float
    duration_ms: float
    logical_reads: float
    execution_count: int
    cpu_contribution_pct: float
    database_name: str
    object_name: Optional[str] = None


class CorrelatedWaitItem(BaseModel):
    wait_category: str
    total_wait_ms: float
    percentage: float
    architectural_diagnosis: str


class CorrelatedEventItem(BaseModel):
    event_time: str
    event_type: str  # DDL_CHANGE, INDEX_OPERATION, AUTO_GROWTH, SYSTEM_EVENT
    object_name: str
    database_name: str
    description: str
    risk_level: Literal["HIGH", "MEDIUM", "LOW"] = "MEDIUM"


class TimeTravelSnapshotDetail(BaseModel):
    interval_id: int
    start_time: str
    end_time: str
    total_cpu_ms: float
    total_executions: int
    distinct_plans_count: int
    dominant_wait_category: str
    is_anomaly_spike: bool
    spike_score: float = 0.0
    queries: List[CorrelatedQueryItem] = Field(default_factory=list)
    waits: List[CorrelatedWaitItem] = Field(default_factory=list)
    events: List[CorrelatedEventItem] = Field(default_factory=list)
    root_cause_diagnosis: str
    recommended_action_title: str
    recommended_action_sql: Optional[str] = None


class TimeTravelTimelinePoint(BaseModel):
    interval_id: int
    time_label: str
    start_time: str
    cpu_load_percent: float
    total_cpu_ms: float
    total_executions: int
    dominant_wait_category: str
    is_anomaly_spike: bool
    spike_severity: Literal["CRITICAL", "WARNING", "NORMAL"] = "NORMAL"


class TimeTravelCorrelatorOverview(BaseModel):
    database_name: str
    server_name: str = "localhost"
    time_range: str = "24H"
    is_demo: bool = False
    total_intervals: int
    detected_spikes_count: int
    timeline: List[TimeTravelTimelinePoint] = Field(default_factory=list)
    initial_interval_id: int
    initial_snapshot: Optional[TimeTravelSnapshotDetail] = None
