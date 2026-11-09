"""tests/test_time_travel.py — Unit tests for Workload Time-Travel Correlator & Spike Detective."""
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_time_travel_overview_endpoint():
    response = client.get("/api/time-travel/overview?database=Datapath_TestDB&time_range=24H")
    assert response.status_code == 200
    data = response.json()
    assert "database_name" in data
    assert "timeline" in data
    assert isinstance(data["timeline"], list)
    assert len(data["timeline"]) > 0
    assert "initial_interval_id" in data
    assert "initial_snapshot" in data

    first_point = data["timeline"][0]
    assert "interval_id" in first_point
    assert "cpu_load_percent" in first_point
    assert "dominant_wait_category" in first_point


def test_time_travel_snapshot_endpoint():
    # First get overview to obtain a valid interval ID
    overview_resp = client.get("/api/time-travel/overview?database=Datapath_TestDB")
    overview_data = overview_resp.json()
    interval_id = overview_data["initial_interval_id"]

    response = client.get(f"/api/time-travel/snapshot?interval_id={interval_id}&database=Datapath_TestDB")
    assert response.status_code == 200
    snap = response.json()
    assert snap["interval_id"] == interval_id
    assert "queries" in snap
    assert "waits" in snap
    assert "events" in snap
    assert "root_cause_diagnosis" in snap
    assert "recommended_action_title" in snap
