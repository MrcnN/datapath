"""tests/test_tempdb_memory.py — Unit tests for TempDB & Memory Intelligence endpoints."""
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_tempdb_memory_endpoint():
    response = client.get("/api/tempdb-memory")
    assert response.status_code == 200
    data = response.json()

    # TempDB
    assert "space_breakdown" in data
    assert "user_objects_mb" in data["space_breakdown"]
    assert "internal_objects_mb" in data["space_breakdown"]
    assert "version_store_mb" in data["space_breakdown"]
    assert "unallocated_space_mb" in data["space_breakdown"]

    assert "tempdb_files" in data
    assert len(data["tempdb_files"]) > 0
    assert "file_count" in data
    assert "cpu_cores" in data
    assert "sizing_equal" in data
    assert "file_count_status" in data
    assert "allocation_contention_detected" in data
    assert "contention_description" in data

    # Memory
    assert "page_life_expectancy_sec" in data
    assert "ple_status" in data
    assert "buffer_cache_hit_ratio" in data
    assert "total_server_memory_mb" in data
    assert "target_server_memory_mb" in data
    assert "top_memory_clerks" in data
    assert len(data["top_memory_clerks"]) > 0

    first_clerk = data["top_memory_clerks"][0]
    assert "clerk_type" in first_clerk
    assert "friendly_name" in first_clerk
    assert "size_mb" in first_clerk
    assert "percentage_of_total" in first_clerk
