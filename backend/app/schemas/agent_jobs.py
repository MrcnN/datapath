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
