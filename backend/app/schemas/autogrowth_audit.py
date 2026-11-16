"""schemas/autogrowth_audit.py — Database Auto-Growth & Auto-Shrink Risk Auditor models."""
from __future__ import annotations

from typing import List, Optional, Literal
from pydantic import BaseModel, Field


class DatabaseFileGrowthRiskItem(BaseModel):
    database_name: str
    logical_name: str
    file_type: str  # ROWS, LOG
    physical_name: str
    current_size_mb: float
    is_percent_growth: bool
    growth_setting: str
    effective_growth_mb: float
    is_auto_shrink_on: bool
    is_auto_close_on: bool
    risk_level: Literal["CRITICAL", "HIGH", "WARNING", "HEALTHY"]
    risk_reason: str
    remediation_tsql: str


class AutoGrowthAuditSummary(BaseModel):
    total_files_audited: int
    critical_risk_files: int
    percent_growth_files: int
    tiny_growth_files: int
    auto_shrink_databases: int
    auto_close_databases: int
    instant_file_initialization_enabled: bool
    overall_health: Literal["HEALTHY", "WARNING", "CRITICAL"]
    evaluated_at: str


class AutoGrowthAuditResponse(BaseModel):
    summary: AutoGrowthAuditSummary
    items: List[DatabaseFileGrowthRiskItem]
    remediation_batch_script: str
