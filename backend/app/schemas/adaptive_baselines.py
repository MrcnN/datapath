"""schemas/adaptive_baselines.py — Schemas for Adaptive Query Performance Baselines & Regression Warning Engine."""
from __future__ import annotations

from typing import List, Optional
from pydantic import BaseModel, Field


class BaselineTrendPoint(BaseModel):
    timestamp_label: str = Field(..., description="Hourly/Daily interval label (e.g. '14:00', '15:00', 'Dün')")
    duration_ms: float = Field(..., description="Average query duration in ms")
    cpu_ms: float = Field(..., description="Average CPU time in ms")
    logical_reads: float = Field(..., description="Average logical reads")
    is_anomaly: bool = Field(False, description="True if value exceeded upper confidence bound")


class AdaptiveQueryRegression(BaseModel):
    query_id: int = Field(..., description="Query Store query ID")
    query_hash: str = Field(..., description="Query binary hash identifier")
    database_name: str = Field(..., description="Database name")
    query_text_snippet: str = Field(..., description="Formatted SQL query text")
    regression_type: str = Field(..., description="PLAN_CHANGE, PARAMETER_SNIFFING, DATA_VOLUME_DRIFT, or RESOURCE_CONTENTION")
    regression_type_label: str = Field(..., description="User-friendly Turkish category label")
    severity: str = Field(..., description="CRITICAL (P1), HIGH (P2), or MODERATE (P3)")
    current_duration_ms: float = Field(..., description="Recent observed average duration in ms")
    baseline_duration_ms: float = Field(..., description="Historical baseline average duration in ms")
    duration_delta_pct: float = Field(..., description="Percentage increase in duration")
    current_cpu_ms: float = Field(..., description="Recent observed average CPU time in ms")
    baseline_cpu_ms: float = Field(..., description="Historical baseline average CPU time in ms")
    cpu_delta_pct: float = Field(..., description="Percentage change in CPU")
    current_logical_reads: float = Field(..., description="Recent observed average logical reads")
    baseline_logical_reads: float = Field(..., description="Historical baseline average logical reads")
    reads_delta_pct: float = Field(..., description="Percentage change in logical reads")
    z_score: float = Field(..., description="Statistical standard deviations above mean baseline")
    upper_bound_ms: float = Field(..., description="Upper confidence limit (mean + 2*sigma)")
    current_plan_id: int = Field(..., description="Current executing plan ID")
    baseline_plan_id: int = Field(..., description="Optimal historical baseline plan ID")
    is_plan_forced: bool = Field(False, description="True if a plan is currently forced in Query Store")
    root_cause_diagnosis: str = Field(..., description="Diagnostic assessment of why regression occurred")
    force_plan_sql: str = Field(..., description="T-SQL script to force the optimal plan")
    unforce_plan_sql: str = Field(..., description="T-SQL script to unforce or clear forced plan")
    remediation_sql: str = Field(..., description="Prescriptive index/stats/hint remediation script")
    trend_points: List[BaselineTrendPoint] = Field(default_factory=list, description="Historical performance sparkline points")


class AdaptiveBaselineSummary(BaseModel):
    total_evaluated_queries: int = Field(..., description="Total active Query Store queries analyzed")
    regressed_queries_count: int = Field(..., description="Count of queries showing statistically significant regression")
    critical_p1_count: int = Field(..., description="Critical P1 regressions (>100% duration spike or Z>3)")
    high_p2_count: int = Field(..., description="High P2 regressions (50-100% duration spike)")
    plan_change_regressions_count: int = Field(..., description="Regressions directly triggered by bad execution plan change")
    forced_plans_active_count: int = Field(..., description="Queries currently under forced plan lock")
    max_duration_spike_pct: float = Field(..., description="Highest percentage duration increase recorded")
    overall_status: str = Field(..., description="HEALTHY, WARNING, or CRITICAL")
    evaluated_at: str = Field(..., description="Timestamp of baseline evaluation")


class AdaptiveBaselineResponse(BaseModel):
    summary: AdaptiveBaselineSummary
    regressions: List[AdaptiveQueryRegression] = Field(default_factory=list)
    recommendations: List[str] = Field(default_factory=list)
