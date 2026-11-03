"""schemas/query_rewriter.py — Smart T-SQL Query Rewriter & Optimizer Studio models."""
from __future__ import annotations

from typing import List, Optional
from pydantic import BaseModel, Field


class DetectedAntiPattern(BaseModel):
    rule_id: str
    category: str = Field(..., description="SARGability & İndeksleme, Sorgu Mimarisi, Kilit & Güvenlik, Performans")
    severity: str = Field(..., description="HIGH, MEDIUM, LOW")
    title: str
    original_fragment: str
    suggested_fragment: str
    explanation: str


class RewriteQueryRequest(BaseModel):
    query_text: str
    database: Optional[str] = None


class RewriteQueryResponse(BaseModel):
    original_query: str
    rewritten_query: str
    anti_patterns_found: int
    estimated_improvement_pct: float
    detected_patterns: List[DetectedAntiPattern]
    explanation_summary: str
