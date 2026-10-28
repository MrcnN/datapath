"""schemas/incidents.py"""
from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class DeadlockParseRequest(BaseModel):
    xml_content: str


class DeadlockProcess(BaseModel):
    process_id: str
    login: Optional[str] = None
    hostname: Optional[str] = None
    db_name: Optional[str] = None
    client_app: Optional[str] = None
    wait_type: Optional[str] = None
    wait_resource: Optional[str] = None
    sql_text: Optional[str] = None


class DeadlockResource(BaseModel):
    resource_type: Optional[str] = None
    db_name: Optional[str] = None
    object_name: Optional[str] = None
    mode: Optional[str] = None
    waiters: List[str] = []


class DeadlockInfo(BaseModel):
    deadlock_id: Optional[str] = None
    timestamp: Optional[datetime] = None
    victims: List[str] = []
    processes: List[DeadlockProcess] = []
    resources: List[DeadlockResource] = []


class AgentJobResult(BaseModel):
    job_name: str
    job_id: str
    step_name: Optional[str] = None
    run_date: Optional[datetime] = None
    run_time: Optional[str] = None
    run_duration_seconds: Optional[int] = None
    outcome_message: Optional[str] = None
    status: str  # "succeeded" | "failed" | "retry" | "cancelled" | "unknown"


class AgentJobResponse(BaseModel):
    available: bool = True
    reason: Optional[str] = None
    jobs: List[AgentJobResult] = []


class ErrorLogEntry(BaseModel):
    log_date: Optional[datetime] = None
    process_info: Optional[str] = None
    message_text: Optional[str] = None
    is_error: bool = False
    severity: Optional[int] = None


class TimelineEvent(BaseModel):
    event_time: Optional[datetime] = None
    event_type: str  # "agent_failure" | "error_log" | "deadlock"
    severity: str  # "low" | "medium" | "high" | "critical"
    source: str
    title: str
    description: Optional[str] = None
    metadata: Optional[dict] = None
