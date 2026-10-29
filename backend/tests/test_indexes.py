"""tests/test_indexes.py — Tests for Index Intelligence endpoints."""
import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_index_summary_endpoint():
    response = client.get("/api/indexes/summary")
    assert response.status_code == 200
    data = response.json()
    assert "total_missing_indexes" in data
    assert "total_unused_indexes" in data
    assert "fragmented_indexes_count" in data
    assert "max_impact_score" in data
    assert "is_demo" in data


def test_missing_indexes_endpoint():
    response = client.get("/api/indexes/missing")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    if data:
        first = data[0]
        assert "table_name" in first
        assert "impact_score" in first
        assert "create_statement" in first
        assert "CREATE NONCLUSTERED INDEX" in first["create_statement"]


def test_unused_indexes_endpoint():
    response = client.get("/api/indexes/unused")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    if data:
        first = data[0]
        assert "index_name" in first
        assert "user_updates" in first
        assert "drop_statement" in first
        assert "DROP INDEX" in first["drop_statement"]


def test_index_fragmentation_endpoint():
    response = client.get("/api/indexes/fragmentation")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    if data:
        first = data[0]
        assert "avg_fragmentation_percent" in first
        assert "recommended_action" in first
        assert first["recommended_action"] in ("REBUILD", "REORGANIZE", "HEALTHY")
        assert "maintenance_statement" in first


def test_table_statistics_endpoint():
    response = client.get("/api/indexes/statistics")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    if data:
        first = data[0]
        assert "table_name" in first
        assert "stats_name" in first
        assert "modification_counter" in first
        assert "staleness_percent" in first
        assert "status" in first
        assert "update_statement" in first
        assert "UPDATE STATISTICS" in first["update_statement"]


def test_redundant_indexes_endpoint():
    response = client.get("/api/indexes/redundant")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    if data:
        first = data[0]
        assert "redundant_index_name" in first
        assert "covering_index_name" in first
        assert "redundancy_type" in first
        assert first["redundancy_type"] in ("EXACT_DUPLICATE", "PREFIX_OVERLAP")
        assert "drop_statement" in first
        assert "DROP INDEX" in first["drop_statement"]



