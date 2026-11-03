"""tests/test_hypothetical_index.py — Test What-If Hypothetical Index Simulator."""
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.db.connection import ConnectionParams
from app.schemas.hypothetical_index import HypotheticalSimulationRequest
from app.services.hypothetical_index_service import simulate_hypothetical_index

client = TestClient(app)


def test_hypothetical_index_service_structure():
    """Test hypothetical index simulation returns valid schema without throwing."""
    params = ConnectionParams(
        server="localhost",
        database="master",
        username=None,
        password=None,
        trusted_connection=True,
    )
    req = HypotheticalSimulationRequest(
        database="master",
        table_name="spt_values",
        key_columns=["number"],
        include_columns=["type"],
        test_query="SELECT type FROM spt_values WHERE number = 10;",
    )
    res = simulate_hypothetical_index(params, req)
    assert hasattr(res, "baseline_cost")
    assert hasattr(res, "simulated_cost")
    assert hasattr(res, "real_create_index_tsql")
    assert "IX_spt_values_number" in res.real_create_index_tsql


def test_simulate_hypothetical_endpoint():
    """Test POST /api/indexes/simulate-hypothetical endpoint."""
    response = client.post(
        "/api/indexes/simulate-hypothetical",
        json={
            "database": "master",
            "table_name": "spt_values",
            "key_columns": ["number"],
            "include_columns": ["type"],
            "test_query": "SELECT type FROM spt_values WHERE number = 10;",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert "simulated_index_name" in data
    assert "cost_reduction_pct" in data
    assert "real_create_index_tsql" in data
