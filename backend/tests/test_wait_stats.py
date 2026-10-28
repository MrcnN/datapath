"""tests/test_wait_stats.py — Unit tests for Wait Statistics endpoints."""
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_wait_statistics_endpoint():
    response = client.get("/api/waits")
    assert response.status_code == 200
    data = response.json()
    assert "total_wait_time_ms" in data
    assert "signal_wait_ratio_percent" in data
    assert "has_cpu_pressure" in data
    assert "top_category" in data
    assert "categories" in data
    assert "wait_stats" in data
    assert len(data["wait_stats"]) > 0

    first_wait = data["wait_stats"][0]
    assert "wait_type" in first_wait
    assert "category" in first_wait
    assert "wait_time_ms" in first_wait
    assert "description" in first_wait
    assert "recommendation" in first_wait
