"""schemas/triage.py — Schema for 1-click emergency incident triage."""
from __future__ import annotations

from typing import List
from pydantic import BaseModel, Field


class TriageFinding(BaseModel):
    category: str  # "BLOCKING" | "CPU" | "MEMORY" | "STORAGE_IO" | "TEMPDB" | "TRANSACTIONS" | "INTEGRITY"
    severity: str  # "CRITICAL" | "WARNING" | "HEALTHY"
    title: str
    metric_value: str
    evidence: List[str] = Field(default_factory=list)
    affected_spids: List[int] = Field(default_factory=list)


class TriageResponse(BaseModel):
    overall_status: str  # "CRITICAL" | "WARNING" | "HEALTHY"
    verdict_title: str
    verdict_summary: str
    primary_bottleneck: str
    remediation_sql: str
    findings: List[TriageFinding] = Field(default_factory=list)
    server_name: str = ""
    analyzed_at: str = ""
    duration_ms: float = 0.0
    is_live: bool = True
