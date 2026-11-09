"""schemas/online_migration.py — Pydantic models for Zero-Downtime Online Schema Migration & Shadow Evolution Studio."""
from __future__ import annotations

from typing import List, Optional, Literal
from pydantic import BaseModel, Field


class ColumnMeta(BaseModel):
    column_name: str
    data_type: str
    max_length: int
    is_nullable: bool
    is_identity: bool
    is_primary_key: bool = False
    default_definition: Optional[str] = None


class IndexMeta(BaseModel):
    index_name: str
    type_desc: str
    is_unique: bool
    is_primary_key: bool
    key_columns: str
    included_columns: Optional[str] = None


class CandidateTableInfo(BaseModel):
    table_name: str
    schema_name: str = "dbo"
    total_rows: int
    total_reserved_mb: float
    column_count: int
    migration_risk_level: Literal["CRITICAL", "HIGH", "MEDIUM", "LOW"] = "MEDIUM"
    recommendation_tip: str


class TableSchemaInspection(BaseModel):
    database_name: str
    schema_name: str = "dbo"
    table_name: str
    total_rows: int
    total_reserved_mb: float
    columns: List[ColumnMeta] = Field(default_factory=list)
    indexes: List[IndexMeta] = Field(default_factory=list)
    foreign_keys_count: int = 0
    is_demo: bool = False


class GenerateMigrationRunbookRequest(BaseModel):
    database_name: str
    table_name: str
    schema_name: str = "dbo"
    pattern: Literal[
        "ADD_NOT_NULL_COLUMN",
        "COLUMN_TYPE_EVOLUTION",
        "ONLINE_INDEX_REBUILD",
        "COLUMN_SPLIT",
    ]
    target_column: Optional[str] = None
    new_column_name: Optional[str] = None
    new_data_type: Optional[str] = None
    default_value: Optional[str] = None
    batch_size: int = 5000
    throttle_delay_ms: int = 50


class MigrationPhaseScript(BaseModel):
    phase_number: int
    phase_name: str
    title: str
    description: str
    sql_script: str
    estimated_duration: str
    lock_type: str
    lock_duration_ms: str
    safety_checklist: List[str] = Field(default_factory=list)


class NaiveVsOnlineComparison(BaseModel):
    naive_approach: str
    naive_lock_type: str
    naive_downtime_estimate: str
    naive_log_risk: str
    online_approach: str
    online_lock_type: str
    online_downtime_estimate: str
    online_log_risk: str


class MigrationRunbookResponse(BaseModel):
    database_name: str
    table_name: str
    schema_name: str
    pattern: str
    summary: str
    comparison: NaiveVsOnlineComparison
    phases: List[MigrationPhaseScript] = Field(default_factory=list)
    emergency_rollback_sql: str
    architectural_guidelines: List[str] = Field(default_factory=list)
