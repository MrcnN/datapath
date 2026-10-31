"""tests/test_webhooks.py — Unit tests for crisis alert webhook endpoints."""
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_get_webhook_config():
    res = client.get("/api/alerts/webhook")
    assert res.status_code == 200
    data = res.json()
    assert "enabled" in data
    assert "url" in data
    assert "service_type" in data
    assert "min_severity" in data


def test_update_webhook_config():
    payload = {
        "enabled": True,
        "url": "https://hooks.slack.com/services/T000/B000/XXXX",
        "service_type": "slack",
        "min_severity": 19,
        "notify_on_deadlocks": True,
        "notify_on_suspect_pages": True,
        "notify_on_high_severity_errors": True,
        "channel_name": "#dba-critical-alerts",
    }
    res = client.post("/api/alerts/webhook", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["enabled"] is True
    assert data["min_severity"] == 19
    assert data["service_type"] == "slack"
    assert data["channel_name"] == "#dba-critical-alerts"


def test_webhook_test_endpoint_invalid_url():
    payload = {
        "url": "invalid-url",
        "service_type": "teams",
    }
    res = client.post("/api/alerts/webhook/test", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is False
    assert data["status_code"] == 400
    assert "Geçersiz Webhook URL" in data["message"]
