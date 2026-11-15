"""tests/test_io_heatmap.py — Unit and integration tests for File IO Latency Heatmap Studio."""
import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_file_io_heatmap_success():
    response = client.get("/api/storage/io-heatmap")
    assert response.status_code == 200
    data = response.json()

    # Structure check
    assert "summary" in data
    assert "drives" in data
    assert "all_files" in data
    assert "recommendations" in data
    assert "evaluated_at" in data

    # Summary check
    summary = data["summary"]
    assert summary["total_files"] >= 1
    assert summary["total_drives"] >= 1
    assert summary["avg_read_latency_ms"] >= 0
    assert summary["avg_write_latency_ms"] >= 0
    assert "highest_latency_file" in summary

    # Drives check
    drives = data["drives"]
    assert isinstance(drives, list)
    assert len(drives) >= 1
    first_drive = drives[0]
    assert "drive_letter" in first_drive
    assert "file_count" in first_drive
    assert "avg_read_latency_ms" in first_drive
    assert "avg_write_latency_ms" in first_drive
    assert "status" in first_drive

    # Files check
    files = data["all_files"]
    assert isinstance(files, list)
    assert len(files) >= 1
    first_file = files[0]
    assert "database_name" in first_file
    assert "file_name" in first_file
    assert "file_type" in first_file
    assert "drive_letter" in first_file
    assert "read_latency_ms" in first_file
    assert "write_latency_ms" in first_file
    assert "overall_latency_ms" in first_file
    assert "status" in first_file
    assert "bottleneck_verdict" in first_file


def test_file_io_heatmap_fallback():
    from app.services.io_heatmap_service import get_file_io_heatmap

    res = get_file_io_heatmap(params=None)
    assert res.summary.total_files >= 1
    assert len(res.drives) >= 1
    assert len(res.all_files) >= 1
