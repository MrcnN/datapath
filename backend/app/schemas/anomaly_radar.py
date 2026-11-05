"""schemas/anomaly_radar.py - Pydantic models for Predictive Anomaly Radar."""
from __future__ import annotations

from typing import List, Optional
from pydantic import BaseModel, Field


class AnomalyMetricPoint(BaseModel):
    timestamp: str = Field(..., description="ISO 8601 or relative minute timestamp")
    value: float = Field(..., description="Observed metric value")
    rolling_mean: float = Field(..., description="Rolling baseline average (mu)")
    upper_bound: float = Field(..., description="Upper control limit (mu + 2*sigma)")
    lower_bound: float = Field(..., description="Lower control limit max(0, mu - 2*sigma)")
    z_score: float = Field(..., description="Standard score (value - mu) / sigma")
    is_anomaly: bool = Field(..., description="True if |z_score| >= 2.0")
    severity: str = Field("NORMAL", description="NORMAL, WARNING, or CRITICAL")


class AnomalyMetricSeries(BaseModel):
    metric_id: str
    metric_name: str
    unit: str
    current_value: float
    baseline_mean: float
    baseline_std: float
    current_z_score: float
    status: str = Field("NORMAL", description="NORMAL, ELEVATED, or ANOMALY_SPIKE")
    datapoints: List[AnomalyMetricPoint] = Field(default_factory=list)


class DetectedAnomalyAlert(BaseModel):
    id: str
    metric_name: str
    timestamp: str
    z_score: float
    severity: str  # WARNING, CRITICAL
    deviation_percent: float
    description: str
    root_cause_hypothesis: str
    recommended_action: str
    surgical_tsql: Optional[str] = None


class AnomalyRadarResponse(BaseModel):
    server_name: str
    evaluated_at: str
    status: str  # NORMAL, WARNING, CRITICAL
    overall_risk_score: int = Field(..., ge=0, le=100)
    active_anomalies_count: int
    series: List[AnomalyMetricSeries] = Field(default_factory=list)
    alerts: List[DetectedAnomalyAlert] = Field(default_factory=list)
