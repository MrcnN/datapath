"""tests/test_extended_events.py — Unit tests for Extended Events (XE) endpoints."""
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_extended_events_summary_endpoint():
    response = client.get("/api/extended-events")
    assert response.status_code == 200
    data = response.json()

    assert "total_sessions" in data
    assert "running_sessions" in data
    assert "stopped_sessions" in data
    assert "system_health_running" in data
    assert "sessions" in data
    assert "recent_events" in data
    assert "templates" in data
    assert "is_demo" in data

    assert len(data["sessions"]) > 0
    first_sess = data["sessions"][0]
    assert "name" in first_sess
    assert "status" in first_sess
    assert first_sess["status"] in ("RUNNING", "STOPPED")
    assert "target_types" in first_sess
    assert "alter_state_script" in first_sess

    assert len(data["recent_events"]) > 0
    first_event = data["recent_events"][0]
    assert "event_type" in first_event
    assert "timestamp" in first_event
    assert "message" in first_event

    assert len(data["templates"]) > 0
    first_tmpl = data["templates"][0]
    assert "id" in first_tmpl
    assert "name" in first_tmpl
    assert "create_script" in first_tmpl
    assert "CREATE EVENT SESSION" in first_tmpl["create_script"]


def test_extended_events_templates_endpoint():
    response = client.get("/api/extended-events/templates")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 3
    for tmpl in data:
        assert "name" in tmpl
        assert "category" in tmpl
        assert "overhead_impact" in tmpl
        assert "create_script" in tmpl
