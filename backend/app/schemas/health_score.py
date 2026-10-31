"""schemas/health_score.py — Schema for cumulative database health score."""
from __future__ import annotations

from typing import List, Optional
from pydantic import BaseModel, Field


class HealthPillar(BaseModel):
    id: str
    name: str
    weight: int
    score: int
    status: str  # "healthy" | "warning" | "critical"
    findings: List[str] = Field(default_factory=list)
    recommendations: List[str] = Field(default_factory=list)


class HealthScoreResponse(BaseModel):
    overall_score: int  # 0 to 100
    grade: str  # "A" | "B" | "C" | "F"
    status: str  # "healthy" | "warning" | "critical"
    summary: str
    pillars: List[HealthPillar] = Field(default_factory=list)
    critical_issues_count: int = 0
    warning_issues_count: int = 0
    server_name: str = ""
    calculated_at: str = ""
    is_live: bool = True
