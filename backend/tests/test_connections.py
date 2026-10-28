"""tests/test_connections.py — Connection test & validation tests."""
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_connection_test_success():
    mock_cursor = MagicMock()
    mock_cursor.description = [
        ("server_name", None, None, None, None, None, None),
        ("product_version", None, None, None, None, None, None),
        ("product_level", None, None, None, None, None, None),
        ("edition", None, None, None, None, None, None),
        ("collation", None, None, None, None, None, None),
        ("version", None, None, None, None, None, None),
    ]
    mock_cursor.fetchall.return_value = [
        ("PROD-SQL-01", "16.0.4095.4", "RTM", "Enterprise Edition (64-bit)", "SQL_Latin1_General_CP1_CI_AS", "Microsoft SQL Server 2022")
    ]
    mock_conn = MagicMock()
    mock_conn.cursor.return_value = mock_cursor

    with patch("app.services.connection_service.get_connection", return_value=mock_conn):
        payload = {
            "server": "localhost",
            "database": "master",
            "trusted_connection": True,
        }
        res = client.post("/api/connections/test", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["server_info"]["server_name"] == "PROD-SQL-01"


def test_connection_test_failure():
    with patch("app.services.connection_service.get_connection", side_effect=Exception("Login timeout expired")):
        payload = {
            "server": "invalid-host",
            "database": "master",
            "trusted_connection": True,
        }
        res = client.post("/api/connections/test", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is False
        assert "Login timeout expired" in data["message"]
