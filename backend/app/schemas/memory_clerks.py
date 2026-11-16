"""schemas/memory_clerks.py — Memory Clerks, Plan Cache Bloat & OS Memory models."""
from __future__ import annotations

from typing import List, Optional, Literal
from pydantic import BaseModel, Field


class MemoryClerkItem(BaseModel):
    clerk_type: str
    friendly_name: str
    category: str  # Buffer Pool, Plan Cache, Query Memory, Security, System
    pages_mb: float
    virtual_memory_mb: float
    percentage_of_total: float


class PlanCacheBloatSummary(BaseModel):
    single_use_plans_count: int
    single_use_plans_mb: float
    multi_use_plans_count: int
    multi_use_plans_mb: float
    total_cache_plans_count: int
    total_cache_plans_mb: float
    adhoc_waste_percentage: float
    optimize_for_adhoc_enabled: bool
    is_bloat_detected: bool
    reclamation_potential_mb: float


class OSMemoryState(BaseModel):
    total_physical_memory_gb: float
    available_physical_memory_gb: float
    system_memory_state: str  # AVAILABLE_HIGH, AVAILABLE_LOW
    sql_memory_in_use_gb: float
    sql_memory_utilization_pct: float
    page_fault_count: int
    is_low_memory_grant_condition: bool


class NumaMemoryNodeItem(BaseModel):
    node_id: int
    memory_node_id: int
    total_pages_mb: float
    foreign_pages_mb: float
    foreign_ratio_pct: float
    health_status: Literal["HEALTHY", "WARNING", "CRITICAL"]


class MemoryClerksResponse(BaseModel):
    total_allocated_mb: float
    clerks: List[MemoryClerkItem]
    plan_cache_bloat: PlanCacheBloatSummary
    os_memory: OSMemoryState
    numa_nodes: List[NumaMemoryNodeItem]
    overall_health: Literal["HEALTHY", "WARNING", "CRITICAL"]
    diagnostic_verdict: str
    remediation_runbook: str
    evaluated_at: str
