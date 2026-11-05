from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_query_store_overview_endpoint():
    response = client.get("/api/query-store/overview")
    assert response.status_code == 200
    data = response.json()
    assert "enabled" in data
    assert "databases_with_qs" in data


def test_plan_anti_patterns_endpoint():
    response = client.get("/api/query-performance/plan-anti-patterns")
    assert response.status_code == 200
    data = response.json()
    assert "total_flagged_plans" in data
    assert "queries" in data
    assert isinstance(data["queries"], list)
    if data["queries"]:
        q = data["queries"][0]
        assert "warning_type" in q
        assert "warning_severity" in q
        assert "recommendation" in q
        assert "query_text" in q


def test_query_regressions_endpoint():
    response = client.get("/api/query-store/regressions")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    if data:
        first_reg = data[0]
        assert "query_id" in first_reg
        assert "old_avg_duration_ms" in first_reg
        assert "new_avg_duration_ms" in first_reg
        assert "cpu_delta_pct" in first_reg
        assert "remediation_sql" in first_reg
        assert "sp_query_store_force_plan" in first_reg["remediation_sql"]



def test_cardinality_drift_endpoint():
    response = client.get("/api/query-performance/cardinality-drift")
    assert response.status_code == 200
    data = response.json()
    assert "evaluated_at" in data
    assert "server_name" in data
    assert "total_analyzed_queries" in data
    assert "items" in data
    assert len(data["items"]) >= 1
    first_item = data["items"][0]
    assert "query_hash" in first_item
    assert "estimated_rows" in first_item
    assert "actual_rows" in first_item
    assert "drift_ratio" in first_item
    assert "drift_direction" in first_item
    assert "remediation_strategy" in first_item
    assert "surgical_tsql" in first_item
