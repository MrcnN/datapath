"""schemas/execution_plan.py — Graphical Execution Plan models."""
from __future__ import annotations

from typing import List, Optional
from pydantic import BaseModel, Field


class PlanOperatorNode(BaseModel):
    node_id: int
    physical_op: str
    logical_op: str
    estimated_cost: float
    estimated_cost_percent: float
    estimated_cpu_cost: float
    estimated_io_cost: float
    estimated_rows: float
    actual_rows: Optional[float] = None
    cardinality_skew: Optional[str] = None
    is_expensive: bool = False
    warnings: List[str] = []
    predicate: Optional[str] = None
    object_name: Optional[str] = None
    output_list: List[str] = []
    children: List[PlanOperatorNode] = []


class MissingIndexRecommendation(BaseModel):
    impact_percent: float
    table_name: str
    equality_columns: List[str] = []
    inequality_columns: List[str] = []
    included_columns: List[str] = []
    create_statement: str


class ParsedExecutionPlan(BaseModel):
    query_text: str
    statement_type: str
    total_cost: float
    optimization_level: str
    compile_cpu_ms: float
    compile_memory_kb: float
    has_warnings: bool
    warnings_count: int
    missing_index: Optional[MissingIndexRecommendation] = None
    root_operator: Optional[PlanOperatorNode] = None
    is_live: bool = True


class ParsePlanRequest(BaseModel):
    plan_xml: Optional[str] = None
    plan_handle: Optional[str] = None
