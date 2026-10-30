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

    # Buffer Pool Distribution & Plan Cache Bloat
    assert "buffer_pool_db_distribution" in data
    assert len(data["buffer_pool_db_distribution"]) > 0
    first_db = data["buffer_pool_db_distribution"][0]
    assert "database_name" in first_db
    assert "buffer_pool_mb" in first_db
    assert "dirty_pages_mb" in first_db
    assert "clean_pages_mb" in first_db

    assert "plan_cache_bloat" in data
    assert data["plan_cache_bloat"] is not None
    bloat = data["plan_cache_bloat"]
    assert "total_cached_plans_count" in bloat
    assert "single_use_plans_count" in bloat
    assert "wasted_adhoc_mb" in bloat
    assert "status" in bloat
    assert "remediation_script" in bloat


def test_memory_grants_endpoint():
    response = client.get("/api/tempdb-memory/memory-grants")
    assert response.status_code == 200
    data = response.json()
    assert "total_grant_count" in data
    assert "waiting_grant_count" in data
    assert "total_granted_mb" in data
    assert "semaphore_pressure" in data
    assert data["semaphore_pressure"] in ("HEALTHY", "PRESSURE_DETECTED", "CRITICAL_STARVATION")
    assert "grants" in data
    assert len(data["grants"]) > 0
    first_grant = data["grants"][0]
    assert "session_id" in first_grant
    assert "requested_memory_mb" in first_grant
    assert "granted_memory_mb" in first_grant
    assert "waste_ratio_percent" in first_grant
    assert "query_text" in first_grant


def test_tempdb_contention_endpoint():
    response = client.get("/api/tempdb-memory/contention")
    assert response.status_code == 200
    data = response.json()
    assert "has_contention" in data
    assert "contention_severity" in data
    assert data["contention_severity"] in ("HEALTHY", "WARNING", "CRITICAL")
    assert "pfs_wait_count" in data
    assert "gam_wait_count" in data
    assert "sgam_wait_count" in data
    assert "total_active_waiters" in data
    assert "recommended_action" in data
    assert "remediation_sql" in data
    assert "waiters" in data
    assert "top_space_consumers" in data
    if data["top_space_consumers"]:
        c = data["top_space_consumers"][0]
        assert "session_id" in c
        assert "user_net_mb" in c
        assert "internal_net_mb" in c
        assert "remediation_sql" in c



