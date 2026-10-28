"""schemas/schema_diff.py"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel


class SchemaDiffRequest(BaseModel):
    source_db: str
    target_db: str
    include_tables: bool = True
    include_views: bool = True
    include_procedures: bool = False
    include_indexes: bool = True


class DiffDetail(BaseModel):
    field: str
    source_value: Optional[Any] = None
    target_value: Optional[Any] = None


class SchemaDiffEntry(BaseModel):
    object_type: str  # TABLE | VIEW | PROCEDURE | INDEX | COLUMN
    object_name: str
    change_type: str  # added | removed | modified
    details: List[DiffDetail] = []
    source_definition: Optional[str] = None
    target_definition: Optional[str] = None


class DiffSummary(BaseModel):
    tables_added: int = 0
    tables_removed: int = 0
    tables_modified: int = 0
    views_added: int = 0
    views_removed: int = 0
    views_modified: int = 0
    columns_changed: int = 0
    indexes_changed: int = 0
    procedures_added: int = 0
    procedures_removed: int = 0
    procedures_modified: int = 0


class SchemaDiffResponse(BaseModel):
    summary: DiffSummary
    differences: List[SchemaDiffEntry]
    generated_script: str
