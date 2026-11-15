"""tests/test_tempdb_forensics.py — Unit and integration tests for TempDB forensics endpoint and service."""
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.schemas.tempdb_forensics import TempDBForensicsResponse
from app.services.tempdb_forensics_service import clean_temp_table_name, get_tempdb_forensics
from app.core.config import settings
from app.db.connection import ConnectionParams

client = TestClient(app)


def test_clean_temp_table_name():
    # Standard SQL Server internal temp table name with hex suffix
    raw = "#OrdersTemp_____________________________________________________________________________________________________________00000000001B"
    assert clean_temp_table_name(raw) == "#OrdersTemp"

    raw2 = "##GlobalCache___0001"
    assert clean_temp_table_name(raw2) == "##GlobalCache"

    assert clean_temp_table_name("") == ""


def test_tempdb_forensics_service():
    params = ConnectionParams(
        server=settings.DB_SERVER,
        database=settings.DB_DATABASE,
        username=settings.DB_USERNAME or None,
        password=settings.DB_PASSWORD or None,
        trusted_connection=settings.DB_TRUSTED_CONNECTION,
        driver=settings.DB_DRIVER,
        timeout=settings.DB_TIMEOUT,
    )
    result = get_tempdb_forensics(params)
    assert isinstance(result, TempDBForensicsResponse)
    assert result.summary is not None
    assert result.summary.overall_risk in ("HEALTHY", "WARNING", "CRITICAL")
    assert len(result.spills) > 0
    assert len(result.session_consumers) > 0
    assert len(result.temp_objects) > 0
    assert len(result.recommendations) > 0


def test_tempdb_forensics_api_endpoint():
    response = client.get("/api/tempdb/forensics")
    assert response.status_code == 200
    data = response.json()
    assert "summary" in data
    assert "spills" in data
    assert "session_consumers" in data
    assert "temp_objects" in data
    assert "recommendations" in data
    assert data["summary"]["active_temp_tables_count"] >= 0
    assert data["summary"]["total_spill_events"] >= 0
