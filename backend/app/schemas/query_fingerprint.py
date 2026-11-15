"""schemas/query_fingerprint.py — Data models for Query Fingerprinting and Signature Normalization."""
from __future__ import annotations

from typing import List, Optional
from pydantic import BaseModel, Field


class QueryFingerprintItem(BaseModel):
    query_hash: str = Field(..., description="Query binary hash from sys.dm_exec_query_stats")
    normalized_signature: str = Field(..., description="Canonical query template with stripped literals")
    sample_raw_sql: str = Field(..., description="Sample executed SQL statement text")
    database_name: str = Field(..., description="Database name")
    total_executions: int = Field(..., description="Total executions aggregated across all parameter variants")
    plan_variants_count: int = Field(..., description="Number of distinct compiled execution plans generated")
    total_duration_ms: float = Field(..., description="Total accumulated duration in ms")
    avg_duration_ms: float = Field(..., description="Average duration per execution in ms")
    min_duration_ms: float = Field(..., description="Minimum recorded duration in ms")
    max_duration_ms: float = Field(..., description="Maximum recorded duration in ms")
    duration_variance_ratio: float = Field(..., description="Max duration / Min duration variance multiplier")
    total_cpu_ms: float = Field(..., description="Total CPU time in ms")
    avg_cpu_ms: float = Field(..., description="Average CPU time in ms")
    total_logical_reads: int = Field(..., description="Total logical IO reads across all executions")
    avg_logical_reads: float = Field(..., description="Average logical IO reads per execution")
    is_parameter_sensitive: bool = Field(False, description="True if max/min variance > 20x or multiple compiled plans")
    is_adhoc_unparameterized: bool = Field(False, description="True if ad-hoc literals detected causing cache bloat")
    risk_verdict: str = Field(..., description="CRITICAL_BLOAT, HIGH_VARIANCE, or OPTIMAL")
    remediation_sql: str = Field(..., description="Prescriptive parameterized T-SQL / Plan Guide script")


class QueryFingerprintSummary(BaseModel):
    total_signatures_evaluated: int = Field(..., description="Count of unique query families identified")
    total_server_executions: int = Field(..., description="Total aggregated query executions across all signatures")
    total_server_duration_ms: float = Field(..., description="Total accumulated server execution duration in ms")
    adhoc_unparameterized_count: int = Field(..., description="Signatures causing plan cache bloat due to unparameterized literals")
    multi_plan_signatures_count: int = Field(..., description="Signatures having multiple competing execution plans")
    top_signature_impact_pct: float = Field(..., description="Percentage of server execution time consumed by #1 query family")


class QueryFingerprintResponse(BaseModel):
    summary: QueryFingerprintSummary
    signatures: List[QueryFingerprintItem] = Field(default_factory=list)
    recommendations: List[str] = Field(default_factory=list)
