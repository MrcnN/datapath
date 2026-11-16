"""schemas/error_log_forensics.py — SQL Server Error Log & Security Incident Forensic models."""
from __future__ import annotations

from typing import List, Optional, Literal
from pydantic import BaseModel, Field


class LoginFailureDetail(BaseModel):
    user_name: str
    client_ip: str
    state_code: int
    state_description: str
    failure_count: int
    first_attempt: str
    last_attempt: str


class ErrorLogCategoryCount(BaseModel):
    category: str
    count: int
    severity: Literal["CRITICAL", "HIGH", "WARNING", "INFO"]


class ClassifiedErrorLogEntry(BaseModel):
    id: int
    log_date: str
    process_info: str
    category: str
    severity: Literal["CRITICAL", "HIGH", "WARNING", "INFO"]
    message: str
    client_ip: Optional[str] = None
    user_name: Optional[str] = None


class ErrorLogForensicsSummary(BaseModel):
    total_log_entries: int
    error_count: int
    login_failures_count: int
    corruption_events_count: int
    memory_dump_count: int
    unique_attacking_ips: int
    audit_level: str
    evaluated_at: str


class ErrorLogForensicsResponse(BaseModel):
    summary: ErrorLogForensicsSummary
    categories: List[ErrorLogCategoryCount]
    top_failed_logins: List[LoginFailureDetail]
    recent_critical_entries: List[ClassifiedErrorLogEntry]
    remediation_runbook: str
