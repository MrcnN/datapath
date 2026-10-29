"""tests/test_storage.py — Unit tests for Storage, Autogrowth, and Virtual File Stats (Disk Latency) endpoints."""
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
    assert "file_io_latencies" in data
    assert "drive_io_summaries" in data
    assert "growth_forecasts" in data

    assert len(data["growth_forecasts"]) > 0
    first_forecast = data["growth_forecasts"][0]
    assert "database_name" in first_forecast
    assert "current_size_mb" in first_forecast
    assert "daily_growth_mb" in first_forecast
    assert "status" in first_forecast

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

    assert len(data["file_io_latencies"]) > 0
    first_io = data["file_io_latencies"][0]
    assert "read_latency_ms" in first_io
    assert "write_latency_ms" in first_io
    assert "overall_latency_ms" in first_io
    assert "status" in first_io
    assert "drive_letter" in first_io
