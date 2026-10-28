"""schemas/indexes.py — Data models for Index Intelligence, Missing Indexes, and Fragmentation."""
from __future__ import annotations

from typing import List, Optional
from pydantic import BaseModel


class MissingIndex(BaseModel):
    database_name: str
    schema_name: str
    table_name: str
    impact_score: float
    user_seeks: int
    user_scans: int
    avg_total_user_cost: float
    avg_user_impact: float
    equality_columns: Optional[str] = None
    inequality_columns: Optional[str] = None
    included_columns: Optional[str] = None
    suggested_index_name: str
    create_statement: str


class UnusedIndex(BaseModel):
    database_name: str
    schema_name: str
    table_name: str
    index_name: str
    index_type: str
    size_mb: float
    user_seeks: int
    user_scans: int
    user_lookups: int
    user_updates: int
    read_writes_ratio: str
    drop_statement: str


class IndexFragmentation(BaseModel):
    database_name: str
    schema_name: str
    table_name: str
    index_name: str
    index_type: str
    avg_fragmentation_percent: float
    page_count: int
    size_mb: float
    recommended_action: str  # REBUILD | REORGANIZE | HEALTHY
    maintenance_statement: str


class IndexSummary(BaseModel):
    total_missing_indexes: int
    max_impact_score: float
    total_unused_indexes: int
    total_wasted_mb: float
    fragmented_indexes_count: int
    is_demo: bool = False
