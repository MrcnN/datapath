"""tests/test_health_score.py — Unit tests for cumulative health score endpoint."""
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health_score_endpoint():
    res = client.get("/api/health-score")
    assert res.status_code == 200
    data = res.json()

    assert "overall_score" in data
    assert "grade" in data
    assert "status" in data
    assert "pillars" in data
    assert isinstance(data["overall_score"], int)
    assert 0 <= data["overall_score"] <= 100
    assert data["grade"] in ["A", "B", "C", "F"]
    assert data["status"] in ["healthy", "warning", "critical"]

    # If live connection worked, pillars must be present
    if data["is_live"]:
        assert len(data["pillars"]) == 5
        pillar_ids = [p["id"] for p in data["pillars"]]
        assert "cpu_waits" in pillar_ids
        assert "memory" in pillar_ids
        assert "storage_io" in pillar_ids
        assert "integrity" in pillar_ids
        assert "backups" in pillar_ids
