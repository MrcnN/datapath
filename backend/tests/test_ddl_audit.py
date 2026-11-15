"""tests/test_ddl_audit.py — Unit and integration tests for DDL Audit & Schema Timeline."""
import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_read_ddl_audit_events_success():
    response = client.get("/api/ddl-audit/events")
    assert response.status_code == 200
    data = response.json()

    # Structure checks
    assert "summary" in data
    assert "events" in data
    assert "source" in data
    assert "evaluated_at" in data

    # Summary checks
    summary = data["summary"]
    assert summary["total_events"] >= 1
    assert "create_count" in summary
    assert "alter_count" in summary
    assert "drop_count" in summary
    assert "unique_users_count" in summary

    # Events checks
    events = data["events"]
    assert isinstance(events, list)
    assert len(events) >= 1

    first = events[0]
    assert "event_id" in first
    assert "event_time" in first
    assert "action_type" in first
    assert "object_type" in first
    assert "object_name" in first
    assert "database_name" in first
    assert "login_name" in first
    assert "risk_level" in first
    assert "impact_summary" in first


def test_read_ddl_audit_events_filter_action():
    resp_alter = client.get("/api/ddl-audit/events?action_type=ALTER")
    assert resp_alter.status_code == 200
    data = resp_alter.json()
    for ev in data["events"]:
        assert ev["action_type"] == "ALTER"


def test_read_ddl_audit_offline_fallback():
    from app.services.ddl_audit_service import get_ddl_audit_events

    res = get_ddl_audit_events(params=None)
    assert res.summary.total_events >= 1
    assert len(res.events) >= 1
    assert res.source in ("DEFAULT_TRACE", "SCHEMA_AUDIT_LOG")
