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
