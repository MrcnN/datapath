"""tests/test_triage.py — Unit tests for emergency triage endpoint."""
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_emergency_triage_endpoint():
    res = client.get("/api/incidents/triage")
    assert res.status_code == 200
    data = res.json()

    assert "overall_status" in data
    assert data["overall_status"] in ["CRITICAL", "WARNING", "HEALTHY"]
    assert "verdict_title" in data
    assert "verdict_summary" in data
    assert "primary_bottleneck" in data
    assert "remediation_sql" in data
    assert "findings" in data
    assert "duration_ms" in data
    assert isinstance(data["duration_ms"], (int, float))

    if data["is_live"]:
        assert len(data["findings"]) >= 1
        for f in data["findings"]:
            assert "category" in f
            assert "severity" in f
            assert "title" in f
            assert "metric_value" in f
