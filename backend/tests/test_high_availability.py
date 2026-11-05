"""tests/test_high_availability.py — Unit tests for AlwaysOn HA Status and Lag Telemetry."""
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_ha_status_endpoint():
    response = client.get("/api/high-availability/status")
    assert response.status_code == 200
    data = response.json()
    assert "available" in data
    assert isinstance(data["groups"], list)


def test_ha_lag_telemetry_endpoint():
    response = client.get("/api/high-availability/lag-telemetry")
    assert response.status_code == 200
    data = response.json()
    assert data["available"] is True
    assert len(data["groups"]) > 0
    group = data["groups"][0]
    assert "ag_name" in group
    assert "primary_replica" in group
    assert "secondary_replicas" in group
    assert "total_log_send_queue_mb" in group
    assert "max_rpo_seconds" in group
    assert "overall_health" in group
    assert group["overall_health"] in ("OPTIMAL", "LAG_WARNING", "CRITICAL_DESYNC")
    assert "replica_metrics" in group
    assert len(group["replica_metrics"]) > 0
    first_metric = group["replica_metrics"][0]
    assert "replica_name" in first_metric
    assert "role" in first_metric
    assert "database_name" in first_metric
    assert "failover_readiness" in first_metric
    assert "remediation_sql" in group
    assert "ALTER AVAILABILITY GROUP" in group["remediation_sql"]
