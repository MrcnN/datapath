"""schemas/maintenance.py — Smart Index Maintenance & Statistics Defragmentation Planner models."""
from __future__ import annotations

from typing import List, Optional
from pydantic import BaseModel, Field


class MaintenanceActionItem(BaseModel):
    database_name: str
    schema_name: str
    table_name: str
    index_name: str
    index_type: str
    avg_fragmentation_percent: float
    page_count: int
    size_mb: float
    action_type: str = Field(..., description="REBUILD_ONLINE, REBUILD_OFFLINE, REORGANIZE, UPDATE_STATS, NO_ACTION")
    urgency: str = Field(..., description="HIGH, MEDIUM, LOW, NONE")
    reason: str
    estimated_duration_sec: float
    command_tsql: str


class MaintenancePlanSummary(BaseModel):
    database_name: str
    total_indexes_evaluated: int
    rebuild_count: int
    reorganize_count: int
    stats_update_count: int
    no_action_count: int
    total_size_mb: float
    estimated_total_minutes: float
    generated_batch_script: str
    generated_agent_job_tsql: str
    items: List[MaintenanceActionItem]
