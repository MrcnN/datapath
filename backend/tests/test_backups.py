"""tests/test_backups.py — Unit tests for Backup History, Recovery Readiness, and Database Integrity endpoints."""
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_backup_history_endpoint():
    response = client.get("/api/backups/history")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_recovery_readiness_endpoint():
    response = client.get("/api/backups/recovery-readiness")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_database_integrity_endpoint():
    response = client.get("/api/backups/integrity")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    if data:
        first = data[0]
        assert "database_name" in first
        assert "last_clean_checkdb" in first
        assert "status" in first
        assert first["status"] in ("HEALTHY", "WARNING", "CRITICAL")
        assert "page_verify_option" in first
        assert "integrity_check_sql" in first
        assert "DBCC CHECKDB" in first["integrity_check_sql"]


def test_integrity_summary_endpoint():
    response = client.get("/api/backups/integrity-summary")
    assert response.status_code == 200
    data = response.json()
    assert "total_databases" in data
    assert "healthy_checkdb_count" in data
    assert "suspect_pages_count" in data
    assert "checkdb_list" in data
    assert "suspect_pages" in data
    assert isinstance(data["suspect_pages"], list)

