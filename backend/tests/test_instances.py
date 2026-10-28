"""tests/test_instances.py — Instance metadata, sessions, and blocking tests."""
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_instance_metadata():
    mock_metadata = {
        "server_name": "SQL-PROD-01",
        "version": "Microsoft SQL Server 2022",
        "edition": "Developer Edition (64-bit)",
        "product_level": "RTM",
        "product_version": "16.0.1000.6",
        "collation": "SQL_Latin1_General_CP1_CI_AS",
        "cpu_count": 8,
        "memory_gb": 32.0,
        "max_memory_gb": 28.0,
        "sql_agent_running": True,
        "databases": [
            {
                "name": "master",
                "state": "ONLINE",
                "recovery_model": "SIMPLE",
                "size_mb": 10.0,
                "log_size_mb": 5.0,
                "compatibility_level": 160,
                "is_read_only": False,
                "create_date": "2022-01-01T00:00:00",
            }
        ],
    }

    with patch("app.api.instances.get_server_metadata", return_value=mock_metadata):
        res = client.get("/api/instance/metadata")
        assert res.status_code == 200
        data = res.json()
        assert data["server_name"] == "SQL-PROD-01"
        assert len(data["databases"]) == 1


def test_sessions_list():
    mock_sessions = [
        {
            "session_id": 55,
            "login_name": "db_user",
            "host_name": "DESKTOP-APP",
            "program_name": "TraceforgeClient",
            "db_name": "master",
            "status": "running",
            "cpu_time": 120,
            "reads": 50,
            "writes": 10,
            "logical_reads": 450,
            "memory_usage": 16,
            "command": "SELECT",
            "wait_type": None,
            "wait_time_ms": 0,
            "blocking_session_id": 0,
            "last_request_start_time": "2026-10-28T00:00:00",
            "sql_text": "SELECT 1;",
        }
    ]

    with patch("app.api.instances.get_sessions", return_value=mock_sessions):
        res = client.get("/api/sessions")
        assert res.status_code == 200
        data = res.json()
        assert len(data) == 1
        assert data[0]["session_id"] == 55


def test_blocking_empty():
    mock_blocking = {
        "has_blocking": False,
        "chains": [],
    }

    with patch("app.api.instances.get_blocking", return_value=mock_blocking):
        res = client.get("/api/blocking")
        assert res.status_code == 200
        data = res.json()
        assert data["has_blocking"] is False
        assert len(data["chains"]) == 0
