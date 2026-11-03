"""schemas/best_practices.py — SQL Server production readiness & best practice advisor models."""
from __future__ import annotations

from typing import List, Optional
from pydantic import BaseModel, Field


class BestPracticeItem(BaseModel):
    id: str
    category: str = Field(..., description="Category: Memory & CPU, Storage & I/O, TempDB Architecture, Database Engine, Reliability & Safety")
    title: str
    description: str
    status: str = Field(..., description="PASS, WARN, FAIL")
    impact: str = Field(..., description="CRITICAL, HIGH, MEDIUM, LOW")
    current_value: str
    recommended_value: str
    remediation_sql: Optional[str] = None


class BestPracticeReport(BaseModel):
    total_rules: int
    passed: int
    warnings: int
    failed: int
    readiness_score: float = Field(..., description="Score 0 - 100")
    server_name: str
    evaluated_at: str
    is_live: bool
    items: List[BestPracticeItem]
