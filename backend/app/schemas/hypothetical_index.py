"""schemas/hypothetical_index.py — What-If Hypothetical Index Simulator models."""
from __future__ import annotations

from typing import List, Optional
from pydantic import BaseModel, Field


class HypotheticalSimulationRequest(BaseModel):
    database: str
    table_name: str
    key_columns: List[str]
    include_columns: List[str] = []
    test_query: str


class HypotheticalSimulationResult(BaseModel):
    database: str
    table_name: str
    simulated_index_name: str
    baseline_cost: float
    simulated_cost: float
    cost_reduction_pct: float
    index_used_by_optimizer: bool
    operator_before: str
    operator_after: str
    verdict: str
    real_create_index_tsql: str
    is_live: bool = True
