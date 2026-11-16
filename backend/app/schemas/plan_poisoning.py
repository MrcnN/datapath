"""schemas/plan_poisoning.py — Parameter Sniffing & Surgical Plan Eviction models."""
from __future__ import annotations

from typing import List, Optional, Literal, Dict, Any
from pydantic import BaseModel, Field


class SniffedParamDetail(BaseModel):
    param_name: str
    compiled_value: Optional[str] = None
    runtime_value: Optional[str] = None


class PoisonedQueryItem(BaseModel):
    plan_handle: str
    sql_handle: str
    query_hash: str
    query_plan_hash: Optional[str] = None
    statement_text: str
    object_name: Optional[str] = None
    database_name: Optional[str] = None
    execution_count: int
    variance_ratio: float = Field(..., description="max_elapsed_ms / min_elapsed_ms oranı")
    cpu_variance_ratio: float = Field(..., description="max_cpu_ms / min_cpu_ms oranı")
    min_elapsed_ms: float
    avg_elapsed_ms: float
    max_elapsed_ms: float
    min_cpu_ms: float
    avg_cpu_ms: float
    max_cpu_ms: float
    min_logical_reads: int
    max_logical_reads: int
    compiled_params: List[SniffedParamDetail] = []
    severity: Literal["CRITICAL", "HIGH", "MEDIUM", "LOW"]
    diagnosis: str
    surgical_eviction_tsql: str
    database_scoped_clear_tsql: str
    sp_recompile_tsql: str
    permanent_hint_tsql: str


class PlanPoisoningSummary(BaseModel):
    total_suspect_queries: int
    critical_count: int
    high_count: int
    avg_variance_ratio: float
    highest_variance_ratio: float
    psp_optimization_enabled: bool
    sql_major_version: int
    evaluated_at: str


class PlanPoisoningResponse(BaseModel):
    summary: PlanPoisoningSummary
    items: List[PoisonedQueryItem]
