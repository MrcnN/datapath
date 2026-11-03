"""tests/test_query_rewriter.py — Test Smart T-SQL Query Rewriter & Anti-Pattern Engine."""
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.query_rewriter_service import rewrite_tsql_query

client = TestClient(app)

BAD_QUERY = """
SELECT *
FROM Orders o
WHERE YEAR(o.OrderDate) = 2026
  AND LEFT(o.CustomerCode, 3) = 'TRX'
  AND o.Notes LIKE '%urgent%';
"""


def test_rewrite_tsql_query_service():
    """Test rewriter catches YEAR, LEFT, SELECT *, and leading LIKE."""
    res = rewrite_tsql_query(BAD_QUERY)
    assert res.anti_patterns_found >= 3
    assert res.estimated_improvement_pct > 50.0
    # YEAR should be rewritten to date range
    assert "o.OrderDate >= '2026-01-01' AND o.OrderDate < '2027-01-01'" in res.rewritten_query
    # LEFT should be rewritten to LIKE 'TRX%'
    assert "o.CustomerCode LIKE 'TRX%'" in res.rewritten_query
    # Patterns should list SARGability issues
    rule_ids = [p.rule_id for p in res.detected_patterns]
    assert "AP-SARG-01" in rule_ids
    assert "AP-SARG-02" in rule_ids
    assert "AP-SEL-STAR" in rule_ids


def test_rewrite_query_endpoint():
    """Test POST /api/query-performance/rewrite endpoint."""
    response = client.post(
        "/api/query-performance/rewrite",
        json={"query_text": BAD_QUERY},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["anti_patterns_found"] >= 3
    assert "o.OrderDate >= '2026-01-01'" in data["rewritten_query"]
    assert isinstance(data["detected_patterns"], list)


def test_rewrite_empty_query():
    """Test rewriter with empty string returns 0 anti-patterns."""
    response = client.post("/api/query-performance/rewrite", json={"query_text": ""})
    assert response.status_code == 200
    data = response.json()
    assert data["anti_patterns_found"] == 0
