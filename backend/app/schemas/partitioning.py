"""schemas/partitioning.py — Pydantic models for Table Partitioning & Sliding Window Lifecycle Advisor."""
from __future__ import annotations

from typing import List, Optional
from pydantic import BaseModel, Field


class PartitionRangeInfo(BaseModel):
    """Detailed boundary and space metrics for a single partition."""
    partition_number: int
    boundary_value: Optional[str] = None
    row_count: int
    reserved_mb: float
    data_mb: float
    index_mb: float
    filegroup_name: str = "PRIMARY"
    is_empty: bool = False


class TablePartitionSummary(BaseModel):
    """Partitioning metadata for an existing partitioned table."""
    table_name: str
    schema_name: str = "dbo"
    is_partitioned: bool = True
    partition_scheme: Optional[str] = None
    partition_function: Optional[str] = None
    partition_key_column: Optional[str] = None
    partition_key_type: Optional[str] = None
    total_partitions: int = 1
    total_rows: int = 0
    total_reserved_mb: float = 0.0
    partitions: List[PartitionRangeInfo] = Field(default_factory=list)
    recommended_action: Optional[str] = None


class PartitionCandidate(BaseModel):
    """Large unpartitioned table identified as a strong partitioning candidate."""
    table_name: str
    schema_name: str = "dbo"
    total_rows: int
    total_reserved_mb: float
    recommended_key_column: Optional[str] = None
    recommended_key_type: Optional[str] = None
    candidate_reason: str
    urgency: str = "MEDIUM"  # 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'
    archival_benefit: str


class PartitioningOverviewResponse(BaseModel):
    """Overview of all partitioned tables and unpartitioned heavy candidates."""
    database_name: str
    server_name: str = "localhost"
    is_demo: bool = False
    total_partitioned_tables: int = 0
    total_candidate_tables: int = 0
    total_managed_partitions: int = 0
    total_partitioned_rows: int = 0
    partitioned_tables: List[TablePartitionSummary] = Field(default_factory=list)
    candidates: List[PartitionCandidate] = Field(default_factory=list)


class GeneratePartitionScriptRequest(BaseModel):
    """Request payload to generate review-only partitioning DDL and sliding-window scripts."""
    database_name: str
    table_name: str
    schema_name: str = "dbo"
    key_column: str
    key_type: str = "DATETIME2"
    boundary_interval: str = "MONTHLY"  # 'MONTHLY' or 'YEARLY'
    start_year: int = 2025
    end_year: int = 2027
    filegroup: str = "PRIMARY"


class GeneratePartitionScriptResponse(BaseModel):
    """Generated review-only T-SQL scripts for partitioning setup and lifecycle maintenance."""
    table_name: str
    partition_function_name: str
    partition_scheme_name: str
    ddl_create_scheme_sql: str
    ddl_rebuild_table_sql: str
    sliding_window_split_sql: str
    switch_archive_sql: str
    architectural_notes: List[str] = Field(default_factory=list)
