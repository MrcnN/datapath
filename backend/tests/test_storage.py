"""tests/test_storage.py — Unit tests for Storage, Autogrowth, and Log Space endpoints."""
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_storage_summary_endpoint():
    response = client.get("/api/storage")
    assert response.status_code == 200
    data = response.json()
    assert "total_data_size_mb" in data
    assert "total_log_size_mb" in data
    assert "total_free_space_mb" in data
    assert "files_with_percent_growth_count" in data
    assert "high_log_usage_dbs_count" in data
    assert "files" in data
    assert "log_spaces" in data
    assert "autogrowth_events" in data

    assert len(data["files"]) > 0
    first_file = data["files"][0]
    assert "database_name" in first_file
    assert "name" in first_file
    assert "file_type" in first_file
    assert "size_mb" in first_file
    assert "free_percent" in first_file
    assert "growth" in first_file
    assert "is_percent_growth" in first_file

    assert len(data["log_spaces"]) > 0
    first_log = data["log_spaces"][0]
    assert "database_name" in first_log
    assert "log_size_mb" in first_log
    assert "log_reuse_wait_desc" in first_log
