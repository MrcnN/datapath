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

    assert "vlf_infos" in data
    assert "critical_vlf_dbs_count" in data
    assert len(data["vlf_infos"]) > 0
    first_vlf = data["vlf_infos"][0]
    assert "database_name" in first_vlf
    assert "vlf_count" in first_vlf
    assert "active_vlf_count" in first_vlf
    assert "status" in first_vlf
    assert first_vlf["status"] in ("HEALTHY", "WARNING", "CRITICAL")
    assert "remediation_script" in first_vlf


def test_open_transactions_endpoint():
    response = client.get("/api/storage/open-transactions")
    assert response.status_code == 200
    data = response.json()
    assert "total_active_transactions" in data
    assert "dormant_open_transactions_count" in data
    assert "longest_running_duration_sec" in data
    assert "total_log_space_held_mb" in data
    assert "transactions" in data
    assert "log_reuse_waits" in data

    assert len(data["transactions"]) > 0
    first_tran = data["transactions"][0]
    assert "session_id" in first_tran
    assert "transaction_name" in first_tran
    assert "database_name" in first_tran
    assert "duration_seconds" in first_tran
    assert "is_dormant_active" in first_tran
    assert "kill_script" in first_tran
    assert "log_bytes_used_mb" in first_tran

    assert len(data["log_reuse_waits"]) > 0
    first_lr = data["log_reuse_waits"][0]
    assert "database_name" in first_lr
    assert "recovery_model" in first_lr
    assert "log_reuse_wait_desc" in first_lr
    assert "status" in first_lr
    assert "root_cause_explanation" in first_lr
    assert "remediation_script" in first_lr


def test_vlf_summary_endpoint():
    response = client.get("/api/storage/vlfs")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) > 0
    first_vlf = data[0]
    assert "database_name" in first_vlf
    assert "vlf_count" in first_vlf
    assert "active_vlf_count" in first_vlf
    assert "status" in first_vlf
    assert "remediation_script" in first_vlf



