"""schemas/high_availability.py"""
from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel


class AGDatabase(BaseModel):
    name: str
    sync_state: Optional[str] = None
    is_suspended: Optional[bool] = None
    redo_queue_size_kb: Optional[int] = None


class AGReplica(BaseModel):
    name: str
    role: Optional[str] = None
    availability_mode: Optional[str] = None
    failover_mode: Optional[str] = None
    operational_state: Optional[str] = None
    synchronization_health: Optional[str] = None


class AvailabilityGroup(BaseModel):
    ag_name: str
    primary_replica: Optional[str] = None
    health_state: Optional[str] = None
    sync_health: Optional[str] = None
    databases: List[AGDatabase] = []
    replicas: List[AGReplica] = []


class HAStatusResponse(BaseModel):
    available: bool
    reason: Optional[str] = None
    groups: List[AvailabilityGroup] = []


class AGReplicaLagMetric(BaseModel):
    replica_name: str
    role: str
    database_name: str
    synchronization_state: str
    availability_mode: str
    is_suspended: bool
    suspend_reason_desc: Optional[str] = None
    log_send_queue_size_kb: float
    log_send_rate_kb_sec: float
    redo_queue_size_kb: float
    redo_rate_kb_sec: float
    estimated_data_loss_sec: float
    estimated_recovery_time_sec: float
    last_commit_time: Optional[str] = None
    failover_readiness: str  # "READY_NO_DATA_LOSS" | "POTENTIAL_DATA_LOSS" | "NOT_READY_SUSPENDED"


class AGTelemetrySummary(BaseModel):
    ag_name: str
    primary_replica: str
    secondary_replicas: List[str] = []
    total_log_send_queue_mb: float
    total_redo_queue_mb: float
    max_rpo_seconds: float
    max_rto_seconds: float
    overall_health: str  # "OPTIMAL" | "LAG_WARNING" | "CRITICAL_DESYNC"
    replica_metrics: List[AGReplicaLagMetric] = []
    remediation_sql: str
    warnings: List[str] = []
    is_demo: bool = False


class AGLagAnalysisResponse(BaseModel):
    available: bool
    reason: Optional[str] = None
    groups: List[AGTelemetrySummary] = []
