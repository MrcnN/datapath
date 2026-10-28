"""schemas/instances.py"""
from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class DatabaseInfo(BaseModel):
    name: str
    state: Optional[str] = None
    recovery_model: Optional[str] = None
    size_mb: Optional[float] = None
    log_size_mb: Optional[float] = None
    compatibility_level: Optional[int] = None
    is_read_only: Optional[bool] = None
    create_date: Optional[datetime] = None


class ServerMetadata(BaseModel):
    server_name: Optional[str] = None
    version: Optional[str] = None
    edition: Optional[str] = None
    product_level: Optional[str] = None
    product_version: Optional[str] = None
    os: Optional[str] = None
    cpu_count: Optional[int] = None
    memory_gb: Optional[float] = None
    max_memory_gb: Optional[float] = None
    sql_agent_running: Optional[bool] = None
    collation: Optional[str] = None
    databases: List[DatabaseInfo] = []


class SessionInfo(BaseModel):
    session_id: int
    login_name: Optional[str] = None
    host_name: Optional[str] = None
    program_name: Optional[str] = None
    db_name: Optional[str] = None
    status: Optional[str] = None
    cpu_time: Optional[int] = None
    reads: Optional[int] = None
    writes: Optional[int] = None
    logical_reads: Optional[int] = None
    memory_usage: Optional[int] = None
    command: Optional[str] = None
    wait_type: Optional[str] = None
    wait_time_ms: Optional[int] = None
    blocking_session_id: Optional[int] = None
    last_request_start_time: Optional[datetime] = None
    sql_text: Optional[str] = None


class BlockedSession(BaseModel):
    session_id: int
    login_name: Optional[str] = None
    host_name: Optional[str] = None
    db_name: Optional[str] = None
    wait_type: Optional[str] = None
    wait_time_ms: Optional[int] = None
    sql_text: Optional[str] = None


class BlockingChain(BaseModel):
    blocker: SessionInfo
    blocked: List[BlockedSession]
    wait_type: Optional[str] = None
    wait_duration_ms: Optional[int] = None


class BlockingResponse(BaseModel):
    has_blocking: bool
    chains: List[BlockingChain] = []


class ConfigurationItem(BaseModel):
    configuration_id: int
    name: str
    description: str
    value: int
    value_in_use: int
    recommended_value: Optional[str] = None
    is_dynamic: bool
    is_advanced: bool
    status: str  # 'OPTIMAL', 'WARNING', 'CRITICAL', 'INFO'
    impact_description: str
    remediation_sql: Optional[str] = None


class ServerConfigurationSummary(BaseModel):
    compliance_score: int
    total_configurations: int
    optimal_count: int
    warning_count: int
    critical_count: int
    items: List[ConfigurationItem] = []
    remediation_script: str
    is_demo: bool = False

