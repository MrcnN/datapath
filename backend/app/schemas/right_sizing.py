"""schemas/right_sizing.py — Data models for Resource Right-Sizing and Cost Optimization Advisor."""
from __future__ import annotations

from typing import List, Optional
from pydantic import BaseModel, Field


class ResourceMetricUtilization(BaseModel):
    resource_type: str = Field(..., description="CPU, MEMORY, or STORAGE_IO")
    allocated_capacity: str = Field(..., description="Configured capacity, e.g. 16 vCPU, 64 GB RAM")
    avg_utilization_pct: float = Field(..., description="Observed average utilization percentage")
    peak_utilization_pct: float = Field(..., description="Peak observed utilization percentage")
    p95_utilization_pct: float = Field(..., description="95th percentile utilization percentage")
    status: str = Field(..., description="OVER_PROVISIONED, OPTIMAL, or UNDER_PROVISIONED")
    verdict_text: str = Field(..., description="Assessment verdict")


class RightSizingAdvice(BaseModel):
    category: str = Field(..., description="CPU_CORES, MAX_SERVER_MEMORY, STORAGE_TIER, or CONFIGURATION")
    title: str = Field(..., description="Actionable recommendation title")
    current_configuration: str = Field(..., description="Current server setting or allocation")
    recommended_configuration: str = Field(..., description="Target right-sized setting")
    estimated_monthly_savings_usd: float = Field(0.0, description="Estimated monthly cloud/license cost savings in USD")
    urgency: str = Field(..., description="HIGH, MEDIUM, or OPPORTUNITY")
    rationale: str = Field(..., description="Technical justification based on performance counters and DMVs")
    remediation_sql: str = Field(..., description="Safe T-SQL script for DBA review")


class RightSizingSummary(BaseModel):
    server_name: str = Field(..., description="SQL Server instance host and instance name")
    edition: str = Field(..., description="SQL Server edition (Enterprise, Standard, etc.)")
    cpu_cores: int = Field(..., description="Logical CPU core count")
    total_ram_gb: float = Field(..., description="Physical server RAM in GB")
    overall_sizing_health: str = Field(..., description="OPTIMAL, OVER_PROVISIONED, or UNDER_PROVISIONED")
    potential_monthly_savings_usd: float = Field(..., description="Total potential cloud licensing savings per month in USD")
    bottlenecks_count: int = Field(..., description="Count of under-provisioned resource bottlenecks")
    waste_opportunities_count: int = Field(..., description="Count of over-provisioned waste reduction opportunities")
    evaluated_at: str = Field(..., description="Evaluation timestamp")


class RightSizingResponse(BaseModel):
    summary: RightSizingSummary
    metrics: List[ResourceMetricUtilization] = Field(default_factory=list)
    recommendations: List[RightSizingAdvice] = Field(default_factory=list)
