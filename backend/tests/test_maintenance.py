"""tests/test_maintenance.py — Test Smart Maintenance & Index Defrag Planner."""
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.db.connection import ConnectionParams
from app.services.maintenance_service import generate_maintenance_plan

client = TestClient(app)


def test_generate_maintenance_plan_structure():
    """Test maintenance plan returns a valid structure with batch script and job tsql."""
    params = ConnectionParams(
        server="localhost",
        database="master",
        username=None,
        password=None,
        trusted_connection=True,
    )
    plan = generate_maintenance_plan(params, "master")
    assert hasattr(plan, "total_indexes_evaluated")
    assert hasattr(plan, "rebuild_count")
    assert hasattr(plan, "reorganize_count")
    assert hasattr(plan, "stats_update_count")
    assert hasattr(plan, "generated_batch_script")
    assert hasattr(plan, "generated_agent_job_tsql")
    assert isinstance(plan.items, list)


def test_get_maintenance_plan_endpoint():
    """Test GET /api/indexes/maintenance-plan endpoint."""
    response = client.get("/api/indexes/maintenance-plan?database=master&min_pages=500")
    assert response.status_code == 200
    data = response.json()
    assert "database_name" in data
    assert "total_indexes_evaluated" in data
    assert "rebuild_count" in data
    assert "generated_batch_script" in data
    assert "items" in data
