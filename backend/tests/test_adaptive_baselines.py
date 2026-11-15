"""tests/test_adaptive_baselines.py — Tests for Adaptive Query Performance Baselines."""
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.schemas.adaptive_baselines import AdaptiveBaselineResponse
from app.services.adaptive_baselines_service import get_adaptive_baselines, generate_mock_trend
from app.core.config import settings
from app.db.connection import ConnectionParams

client = TestClient(app)


def test_generate_mock_trend():
    trend = generate_mock_trend(25.0, 500.0)
    assert len(trend) == 7
    assert trend[-1].is_anomaly is True
    assert trend[0].is_anomaly is False


def test_adaptive_baselines_service():
    params = ConnectionParams(
        server=settings.DB_SERVER,
        database=settings.DB_DATABASE,
        username=settings.DB_USERNAME or None,
        password=settings.DB_PASSWORD or None,
        trusted_connection=settings.DB_TRUSTED_CONNECTION,
        driver=settings.DB_DRIVER,
        timeout=settings.DB_TIMEOUT,
    )
    res = get_adaptive_baselines(params)
    assert isinstance(res, AdaptiveBaselineResponse)
    assert res.summary is not None
    assert res.summary.overall_status in ("HEALTHY", "WARNING", "CRITICAL")
    assert len(res.regressions) > 0
    assert len(res.recommendations) > 0
    # Verify regression properties
    first = res.regressions[0]
    assert first.query_id > 0
    assert first.current_duration_ms > 0
    assert first.baseline_duration_ms > 0
    assert len(first.trend_points) == 7


def test_adaptive_baselines_endpoint():
    response = client.get("/api/query-performance/adaptive-baselines")
    assert response.status_code == 200
    data = response.json()
    assert "summary" in data
    assert "regressions" in data
    assert "recommendations" in data
    assert data["summary"]["total_evaluated_queries"] >= 0
    assert data["summary"]["regressed_queries_count"] >= 0
