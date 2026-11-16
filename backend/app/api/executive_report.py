"""api/executive_report.py — API endpoint for Executive Database Health & Audit Report."""
from __future__ import annotations

import logging
from fastapi import APIRouter

from app.schemas.executive_report import ExecutiveReportResponse
from app.services.executive_report_service import generate_executive_health_report

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Reports"])


@router.get("/reports/executive-health", response_model=ExecutiveReportResponse)
def read_executive_health_report():
    """Generate and retrieve a consolidated executive database health audit report,
    including overall health score, pillar breakdown, key risks, and priority T-SQL remediation runbook.
    """
    return generate_executive_health_report()
