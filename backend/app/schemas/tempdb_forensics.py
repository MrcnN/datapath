"""schemas/tempdb_forensics.py — Schemas for TempDB Space Hog & Spill Forensic Investigator."""
from __future__ import annotations

from typing import List, Optional
from pydantic import BaseModel, Field


class TempDBSpillQuery(BaseModel):
    query_hash: str = Field(..., description="Query plan or statement hash")
    query_text: str = Field(..., description="SQL statement text")
    execution_count: int = Field(..., description="Total executions")
    total_spills: int = Field(..., description="Total spilled pages to TempDB")
    total_spill_mb: float = Field(..., description="Total spilled volume in MB")
    last_spills: int = Field(..., description="Spilled pages in last execution")
    last_spill_mb: float = Field(..., description="Spilled volume in last execution in MB")
    avg_spill_mb: float = Field(..., description="Average spilled volume per execution in MB")
    total_worker_time_ms: float = Field(..., description="Total CPU time in ms")
    avg_elapsed_time_ms: float = Field(..., description="Average duration in ms")
    spill_type: str = Field(..., description="Sort Warning, Hash Warning or Spill")
    severity: str = Field(..., description="CRITICAL, WARNING, or INFO")
    root_cause: str = Field(..., description="Forensic diagnostic root cause")
    remediation_sql: str = Field(..., description="Recommended T-SQL remediation script")


class TempDBSessionConsumer(BaseModel):
    session_id: int = Field(..., description="SPID")
    login_name: str = Field(..., description="Login account name")
    host_name: Optional[str] = Field(None, description="Client workstation/host")
    program_name: Optional[str] = Field(None, description="Client application name")
    status: str = Field(..., description="Session status: running, sleeping, etc.")
    open_transaction_count: int = Field(0, description="Active open transaction count")
    cpu_time_ms: int = Field(0, description="CPU time in ms")
    elapsed_time_ms: int = Field(0, description="Total elapsed time in ms")
    user_objects_mb: float = Field(..., description="User objects allocated net MB (#temp, @table)")
    internal_objects_mb: float = Field(..., description="Internal objects allocated net MB (Sorts, Hashes)")
    task_active_mb: float = Field(..., description="Real-time in-flight task allocation MB")
    total_net_mb: float = Field(..., description="Total net TempDB space held in MB")
    current_sql: Optional[str] = Field(None, description="Active or last executed SQL text")
    is_sleeping_with_tran: bool = Field(False, description="True if sleeping with open transaction")
    risk_level: str = Field(..., description="CRITICAL, WARNING, or NORMAL")
    kill_sql: str = Field(..., description="Safe KILL script with inspection headers")
    investigation_sql: str = Field(..., description="Diagnostic T-SQL to inspect session locks/plans")


class TempDBActiveObject(BaseModel):
    object_id: int = Field(..., description="SQL Server internal object ID")
    clean_table_name: str = Field(..., description="Human-readable table name without hash suffix")
    raw_object_name: str = Field(..., description="Raw internal system name in tempdb.sys.tables")
    create_date: str = Field(..., description="Object creation timestamp")
    age_minutes: float = Field(..., description="Age in minutes since creation")
    row_count: int = Field(..., description="Total rows in temporary table")
    total_size_mb: float = Field(..., description="Total allocated size in MB")
    data_size_mb: float = Field(..., description="Data pages size in MB")
    index_size_mb: float = Field(..., description="Index pages size in MB")
    stale_risk: bool = Field(False, description="True if table is older than 60 minutes")


class TempDBForensicsSummary(BaseModel):
    total_spill_events: int = Field(..., description="Count of queries spilling to TempDB")
    total_spill_mb: float = Field(..., description="Total volume of spilled pages across queries in MB")
    highest_spill_query: Optional[str] = Field(None, description="Short snippet of largest spilling query")
    active_temp_tables_count: int = Field(..., description="Count of active #temp tables in TempDB")
    active_temp_tables_mb: float = Field(..., description="Total space occupied by active #temp tables in MB")
    top_consumer_spid: Optional[int] = Field(None, description="SPID with largest TempDB footprint")
    top_consumer_mb: float = Field(0.0, description="MB consumed by largest session")
    sleeping_with_tran_count: int = Field(..., description="Sessions sleeping with open transaction holding TempDB")
    overall_risk: str = Field(..., description="HEALTHY, WARNING, or CRITICAL")


class TempDBForensicsResponse(BaseModel):
    summary: TempDBForensicsSummary
    spills: List[TempDBSpillQuery] = Field(default_factory=list)
    session_consumers: List[TempDBSessionConsumer] = Field(default_factory=list)
    temp_objects: List[TempDBActiveObject] = Field(default_factory=list)
    recommendations: List[str] = Field(default_factory=list)
