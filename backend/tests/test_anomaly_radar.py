"""tests/test_anomaly_radar.py - Unit and regression tests for Anomaly Radar."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_get_anomaly_radar_returns_valid_response():
    response = client.get("/api/anomaly-radar")
    assert response.status_code == 200
    data = response.json()

    assert "server_name" in data
    assert "status" in data
    assert data["status"] in ["NORMAL", "WARNING", "CRITICAL"]
    assert "overall_risk_score" in data
    assert 0 <= data["overall_risk_score"] <= 100
    assert "series" in data
    assert len(data["series"]) >= 3

    # Check series structure
    cpu_series = next((s for s in data["series"] if s["metric_id"] == "cpu_pct" or "cpu" in s["metric_id"].lower()), None)
    assert cpu_series is not None
    assert "current_value" in cpu_series
    assert "baseline_mean" in cpu_series
    assert "current_z_score" in cpu_series
    assert len(cpu_series["datapoints"]) > 0

    # Check alerts structure
    assert "alerts" in data
    if data["alerts"]:
        alert = data["alerts"][0]
        assert "z_score" in alert
        assert "severity" in alert
        assert "recommended_action" in alert


def test_anomaly_radar_datapoint_fields():
    response = client.get("/api/anomaly-radar")
    assert response.status_code == 200
    data = response.json()
    first_series = data["series"][0]
    dp = first_series["datapoints"][0]

    assert "timestamp" in dp
    assert "value" in dp
    assert "rolling_mean" in dp
    assert "upper_bound" in dp
    assert "lower_bound" in dp
    assert "z_score" in dp
    assert "is_anomaly" in dp
    assert "severity" in dp
