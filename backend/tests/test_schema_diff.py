"""tests/test_schema_diff.py — Schema diff service & safety tests."""
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_schema_diff_databases():
    with patch("app.api.schema_diff.list_databases", return_value=["AppDb", "AppDb_Staging"]):
        res = client.get("/api/schema-diff/databases")
        assert res.status_code == 200
        assert res.json() == ["AppDb", "AppDb_Staging"]


def test_schema_diff_compare_safety():
    mock_response = {
        "summary": {
            "tables_added": 1,
            "tables_removed": 0,
            "tables_modified": 0,
            "views_added": 0,
            "views_removed": 0,
            "views_modified": 0,
            "columns_changed": 0,
            "indexes_changed": 0,
        },
        "differences": [
            {
                "object_type": "TABLE",
                "object_name": "dbo.AuditLogs",
                "change_type": "added",
                "details": [],
                "source_definition": None,
                "target_definition": "CREATE TABLE [dbo].[AuditLogs] ([Id] INT);",
            }
        ],
        "generated_script": "-- REVIEW ONLY - DO NOT EXECUTE AUTOMATICALLY\nCREATE TABLE [dbo].[AuditLogs] ([Id] INT);\nGO",
    }

    with patch("app.api.schema_diff.compare_schemas", return_value=mock_response):
        payload = {
            "source_db": "AppDb",
            "target_db": "AppDb_Staging",
            "include_tables": True,
        }
        res = client.post("/api/schema-diff/compare", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["summary"]["tables_added"] == 1
        assert "REVIEW ONLY" in data["generated_script"]
