"""tests/test_fleet.py — Tests for Multi-Server Fleet Overview & Estate Intelligence."""
import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_fleet_overview_success():
    response = client.get("/api/fleet/overview")
    assert response.status_code == 200
    data = response.json()

    # Check structure
    assert "summary" in data
    assert "servers" in data
    assert "active_server_id" in data
    assert "evaluated_at" in data
    assert "top_risks" in data

    # Check summary metrics
    summary = data["summary"]
    assert summary["total_instances"] >= 1
    assert summary["average_health_score"] >= 0
    assert summary["average_cpu_pct"] >= 0
    assert isinstance(summary["total_active_connections"], int)

    # Check servers list
    servers = data["servers"]
    assert isinstance(servers, list)
    assert len(servers) >= 1

    # Check at least one server is active
    active_servers = [s for s in servers if s["is_active"] is True]
    assert len(active_servers) == 1
    assert active_servers[0]["id"] == data["active_server_id"]

    # Check server item attributes
    first_srv = servers[0]
    assert "name" in first_srv
    assert "environment" in first_srv
    assert "status" in first_srv
    assert "health_score" in first_srv
    assert "cpu_pct" in first_srv
    assert "disk_free_min_pct" in first_srv
    assert "backup_health" in first_srv
    assert "verdict" in first_srv


def test_fleet_overview_offline_fallback():
    from app.services.fleet_service import get_fleet_overview

    # Force fallback by passing invalid params
    result = get_fleet_overview(params=None)
    assert result.summary.total_instances >= 1
    assert len(result.servers) >= 1
    assert result.active_server_id is not None
