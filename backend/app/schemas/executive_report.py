"""schemas/executive_report.py — Pydantic schemas for Executive Database Health & Audit Report."""
from __future__ import annotations

from typing import List, Optional
from pydantic import BaseModel, Field


class ReportPillarSummary(BaseModel):
    """Summary of a specific architectural health pillar."""

    id: str = Field(..., description="Sütun ID (cpu, memory, storage, integrity, backup)")
    name: str = Field(..., description="Sütun adı")
    score: int = Field(..., description="Alınan puan")
    max_weight: int = Field(..., description="Maksimum ağırlık")
    status: str = Field(..., description="healthy, warning, critical")
    findings: List[str] = Field(default_factory=list, description="Tespit edilen bulgular")
    recommendations: List[str] = Field(default_factory=list, description="İyileştirme tavsiyeleri")


class PriorityAction(BaseModel):
    """A prioritized DBA action item for executive decision making."""

    rank: int = Field(..., description="Öncelik sırası")
    title: str = Field(..., description="Eylem başlığı")
    category: str = Field(..., description="Kategori: Yedekleme, Bellek, Depolama, vb.")
    urgency: str = Field("HIGH", description="CRITICAL, HIGH, MEDIUM")
    impact: str = Field(..., description="Etki ve risk analizi")
    remediation_tsql: str = Field("", description="Önerilen T-SQL betiği")


class ExecutiveReportResponse(BaseModel):
    """Full payload for the Executive Database Health & Audit Report."""

    server_name: str = Field(..., description="Sunucu adı")
    overall_score: int = Field(..., description="Bütünleşik sağlık skoru (0-100)")
    health_status: str = Field(..., description="healthy, warning, critical")
    generated_at: str = Field(..., description="Rapor üretim zaman damgası")
    pillars: List[ReportPillarSummary] = Field(default_factory=list)
    key_risks: List[str] = Field(default_factory=list)
    priority_actions: List[PriorityAction] = Field(default_factory=list)
    markdown_content: str = Field(..., description="Yönetim ve paylaşım için tam Markdown rapor metni")
