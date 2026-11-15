"""tests/test_alert_rules.py — Unit and integration tests for Custom Alert Rules & Threshold Engine."""
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.schemas.alert_rules import AlertMetric, AlertOperator, AlertSeverity

client = TestClient(app)


def test_list_alert_rules():
    response = client.get("/api/alerts/rules")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 5
    metrics = [r["metric"] for r in data]
    assert "CPU_UTILIZATION" in metrics
    assert "DISK_FREE_SPACE_PCT" in metrics


def test_get_single_rule():
    # First get list to find an ID
    list_resp = client.get("/api/alerts/rules")
    rules = list_resp.json()
    first_id = rules[0]["id"]

    resp = client.get(f"/api/alerts/rules/{first_id}")
    assert resp.status_code == 200
    rule = resp.json()
    assert rule["id"] == first_id

    # Non-existent ID
    resp_404 = client.get("/api/alerts/rules/non-existent-rule-xyz")
    assert resp_404.status_code == 404


def test_create_and_delete_rule():
    payload = {
        "name": "Test Test Eşik Kuralı",
        "metric": "CPU_UTILIZATION",
        "operator": ">",
        "threshold": 95.0,
        "unit": "%",
        "severity": "CRITICAL",
        "duration_seconds": 45,
        "cooldown_minutes": 10,
        "is_enabled": True,
        "notify_channels": ["webhook", "in_app"],
        "description": "Test kural açıklaması",
        "remediation_hint": "Test çözüm tavsiyesi",
    }

    create_resp = client.post("/api/alerts/rules", json=payload)
    assert create_resp.status_code == 201
    created = create_resp.json()
    rule_id = created["id"]
    assert created["name"] == payload["name"]
    assert created["threshold"] == 95.0

    # Clean up delete
    del_resp = client.delete(f"/api/alerts/rules/{rule_id}")
    assert del_resp.status_code == 200
    assert del_resp.json()["success"] is True

    # Verify deleted
    get_resp = client.get(f"/api/alerts/rules/{rule_id}")
    assert get_resp.status_code == 404


def test_update_rule():
    # Create temp rule
    payload = {
        "name": "Geçici Kural",
        "metric": "TEMPDB_UTILIZATION_PCT",
        "operator": ">",
        "threshold": 70.0,
        "unit": "%",
        "severity": "WARNING",
        "duration_seconds": 60,
        "cooldown_minutes": 15,
        "is_enabled": True,
        "notify_channels": ["in_app"],
    }
    create_resp = client.post("/api/alerts/rules", json=payload)
    rule_id = create_resp.json()["id"]

    # Update threshold to 88.0
    payload["threshold"] = 88.0
    payload["severity"] = "CRITICAL"
    update_resp = client.put(f"/api/alerts/rules/{rule_id}", json=payload)
    assert update_resp.status_code == 200
    updated = update_resp.json()
    assert updated["threshold"] == 88.0
    assert updated["severity"] == "CRITICAL"

    # Clean up
    client.delete(f"/api/alerts/rules/{rule_id}")


def test_toggle_rule():
    list_resp = client.get("/api/alerts/rules")
    first_id = list_resp.json()[0]["id"]

    # Toggle to False
    resp1 = client.patch(f"/api/alerts/rules/{first_id}/toggle?is_enabled=false")
    assert resp1.status_code == 200
    assert resp1.json()["is_enabled"] is False

    # Toggle back to True
    resp2 = client.patch(f"/api/alerts/rules/{first_id}/toggle?is_enabled=true")
    assert resp2.status_code == 200
    assert resp2.json()["is_enabled"] is True


def test_evaluate_rules():
    resp = client.post("/api/alerts/rules/evaluate?trigger_webhooks=false")
    assert resp.status_code == 200
    data = resp.json()
    assert "server_name" in data
    assert "total_rules" in data
    assert "active_rules" in data
    assert "triggered_count" in data
    assert "evaluations" in data
    assert isinstance(data["evaluations"], list)
    assert len(data["evaluations"]) > 0


def test_simulate_alert():
    # Simulation with high CPU exceeding 85%
    req = {
        "metric": "CPU_UTILIZATION",
        "mock_value": 94.5,
        "send_webhook": False,
    }
    resp = client.post("/api/alerts/rules/simulate", json=req)
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["is_breached"] is True
    assert "EŞİK AŞILDI" in data["message"]

    # Simulation with low CPU not breaching
    req_normal = {
        "metric": "CPU_UTILIZATION",
        "mock_value": 15.0,
        "send_webhook": False,
    }
    resp_norm = client.post("/api/alerts/rules/simulate", json=req_normal)
    assert resp_norm.status_code == 200
    assert resp_norm.json()["is_breached"] is False
