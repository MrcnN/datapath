"""tests/test_buffer_pool_drilldown.py — Test Buffer Pool Drilldown & Memory Tomography."""
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.db.connection import ConnectionParams
from app.services.tempdb_memory_service import get_buffer_pool_drilldown

client = TestClient(app)


def test_get_buffer_pool_drilldown_structure():
    """Test get_buffer_pool_drilldown returns a valid response structure."""
    params = ConnectionParams(
        server="localhost",
        database="master",
        username=None,
        password=None,
        trusted_connection=True,
    )
    res = get_buffer_pool_drilldown(params, "master")
    assert hasattr(res, "total_cached_mb")
    assert hasattr(res, "dirty_pages_mb")
    assert hasattr(res, "clean_pages_mb")
    assert hasattr(res, "checkpoint_urgency")
    assert isinstance(res.items, list)


def test_get_buffer_pool_drilldown_endpoint():
    """Test GET /api/tempdb-memory/buffer-pool-drilldown endpoint."""
    response = client.get("/api/tempdb-memory/buffer-pool-drilldown?database=master")
    assert response.status_code == 200
    data = response.json()
    assert "database" in data
    assert "total_cached_mb" in data
    assert "dirty_pages_mb" in data
    assert "items" in data
