"""schemas/agent_jobs.py — Data models for SQL Server Agent jobs, step history, and failure diagnostics."""
from __future__ import annotations

from typing import List, Optional
from pydantic import BaseModel


class JobStepHistory(BaseModel):
    step_id: int
    step_name: str
    run_status: str  # "SUCCESS", "FAILED", "CANCELLED", "IN_PROGRESS", "RETRY", "UNKNOWN"
    run_date: str
    run_duration_sec: int
    message: str


class AgentJobDetail(BaseModel):
    job_id: str
    name: str
    enabled: bool
    category: str
    description: Optional[str] = None
    last_run_status: str  # "SUCCESS", "FAILED", "CANCELLED", "NEVER_RUN", "UNKNOWN"
    last_run_date: Optional[str] = None
    last_run_duration_sec: Optional[int] = None
    next_run_date: Optional[str] = None
    last_failed_step_id: Optional[int] = None
    last_failed_message: Optional[str] = None
    steps: List[JobStepHistory] = []


class AgentJobsSummary(BaseModel):
    agent_running: bool
    total_jobs: int
    enabled_jobs: int
    disabled_jobs: int
    failed_jobs_count: int
    running_jobs_count: int
    jobs: List[AgentJobDetail] = []
    is_demo: bool = False


class SQLAlertDetail(BaseModel):
    name: str
    message_id: int  # e.g. 823, 824, 825
    severity: int    # 17-25
    enabled: bool
    delay_between_responses: int
    last_occurrence: Optional[str] = None
    occurrence_count: int
    has_notification: bool
    operator_name: Optional[str] = None
    is_best_practice_missing: bool = False
    status: str = "CONFIGURED"  # CONFIGURED | MISSING_CRITICAL | NO_OPERATOR


class DatabaseMailItem(BaseModel):
    mailitem_id: int
    recipients: str
    subject: str
    send_request_date: str
    send_request_user: str
    sent_status: str  # failed | unsent | retrying | sent
    last_mod_date: Optional[str] = None
    error_description: Optional[str] = None


class DatabaseMailStatus(BaseModel):
    mail_queue_status: str  # STARTED | STOPPED | INACTIVE
    total_failed_items: int
    total_unsent_items: int
    total_sent_items: int
    recent_failed_items: List[DatabaseMailItem] = []
    restart_queue_sql: str
    cleanup_failed_sql: str


class AlertsAndMailSummary(BaseModel):
    total_alerts: int
    critical_alerts_missing_count: int
    has_unnotified_alerts: bool
    mail_status: DatabaseMailStatus
    alerts: List[SQLAlertDetail] = []
    create_missing_alerts_sql: str
    is_demo: bool = False

