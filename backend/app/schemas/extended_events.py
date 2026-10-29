"""schemas/extended_events.py — Data models for Extended Events (XE) sessions, ring buffer events, and templates."""
from __future__ import annotations

from typing import List, Optional
from pydantic import BaseModel


class XESession(BaseModel):
    name: str
    status: str  # "RUNNING" | "STOPPED"
    auto_start: bool
    total_buffer_size_kb: float
    max_memory_kb: float
    event_retention_mode: str
    dropped_buffer_count: int = 0
    dropped_event_count: int = 0
    largest_event_dropped_size: int = 0
    targets: List[str] = []
    target_types: str  # "ring_buffer", "event_file", etc.
    event_count: int = 0
    start_time: Optional[str] = None
    alter_state_script: str  # ALTER EVENT SESSION [<name>] ON SERVER STATE = START/STOP;
    drop_script: str


class RingBufferEvent(BaseModel):
    event_type: str  # "deadlock", "error_reported", "connectivity", "memory_broker"
    timestamp: str
    severity: Optional[int] = None
    error_number: Optional[int] = None
    message: str
    database_name: Optional[str] = None
    session_id: Optional[int] = None
    details: Optional[str] = None
    xml_payload: Optional[str] = None


class XETemplate(BaseModel):
    id: str
    name: str
    category: str
    description: str
    overhead_impact: str  # "VERY_LOW" | "LOW" | "MODERATE"
    target_type: str  # "ring_buffer" | "event_file"
    create_script: str


class ExtendedEventsSummary(BaseModel):
    total_sessions: int
    running_sessions: int
    stopped_sessions: int
    system_health_running: bool
    total_dropped_events: int
    severe_errors_count: int
    deadlocks_in_ring_count: int
    sessions: List[XESession] = []
    recent_events: List[RingBufferEvent] = []
    templates: List[XETemplate] = []
    is_demo: bool = False
