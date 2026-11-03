"""schemas/rca_report.py — Incident Root-Cause Analysis (RCA) Post-Mortem models."""
from __future__ import annotations

from typing import List, Optional
from pydantic import BaseModel, Field


class RCATimelineEntry(BaseModel):
    timestamp: str
    event: str
    severity: str = Field(..., description="INFO, WARNING, CRITICAL")


class RCACorrectiveAction(BaseModel):
    priority: str = Field(..., description="P0, P1, P2")
    action: str
    owner: str = "DBA / DevOps Team"
    status: str = "TODO"


class RCARequest(BaseModel):
    incident_type: str = Field(..., description="DEADLOCK, BLOCKING_STORM, TEMPDB_EXHAUSTION, MEMORY_GRANT_TIMEOUT, CUSTOM")
    database: Optional[str] = "ProductionDB"
    incident_title: Optional[str] = None
    root_query_text: Optional[str] = None
    victim_query_text: Optional[str] = None
    spids: List[int] = []


class RCAReport(BaseModel):
    report_id: str
    generated_at: str
    incident_title: str
    severity: str
    database: str
    executive_summary: str
    root_cause_analysis: str
    impact_assessment: str
    timeline: List[RCATimelineEntry]
    corrective_actions: List[RCACorrectiveAction]
    remediation_tsql: str
    markdown_content: str
