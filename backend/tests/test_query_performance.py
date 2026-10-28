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
