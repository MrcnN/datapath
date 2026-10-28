"""schemas/toolkit.py"""
from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel


class DBAScript(BaseModel):
    id: str
    name: str
    category: str
    description: str
    sql: str
    risk_level: str  # read_only | caution | destructive
    tags: List[str] = []
    min_sql_version: Optional[str] = None
    notes: Optional[str] = None


class ScriptCategory(BaseModel):
    name: str
    description: str
    script_count: int
