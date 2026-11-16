"""schemas/schedulers.py — CPU SOS Schedulers & Worker Thread Pool models."""
from __future__ import annotations

from typing import List, Optional, Literal
from pydantic import BaseModel, Field


class SchedulerCoreItem(BaseModel):
    scheduler_id: int
    cpu_id: int
    numa_node_id: int
    status: str
    is_idle: bool
    current_tasks_count: int
    runnable_tasks_count: int
    current_workers_count: int
    active_workers_count: int
    work_queue_count: int
    pending_disk_io_count: int
    yield_count: int
    load_factor: int
    health_status: Literal["HEALTHY", "WARNING", "CRITICAL"]


class NumaNodeItem(BaseModel):
    node_id: int
    node_state: str
    memory_node_id: int
    cpu_count: int
    online_scheduler_count: int
    active_worker_count: int
    avg_load_factor: float


class ThreadPoolSummary(BaseModel):
    max_workers_count: int
    total_active_workers: int
    worker_utilization_pct: float
    total_work_queue_count: int
    total_runnable_tasks: int
    avg_runnable_per_scheduler: float
    total_pending_disk_io: int
    visible_online_schedulers: int
    logical_cpu_count: int
    socket_count: int
    numa_nodes_count: int
    has_threadpool_starvation: bool
    has_cpu_queue_pressure: bool
    overall_health: Literal["HEALTHY", "WARNING", "CRITICAL"]
    verdict: str
    evaluated_at: str


class SchedulersResponse(BaseModel):
    summary: ThreadPoolSummary
    schedulers: List[SchedulerCoreItem]
    numa_nodes: List[NumaNodeItem]
    remediation_runbook: str
