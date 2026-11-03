"""tests/test_best_practices.py — Test SQL Server production readiness & best practice advisor."""
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.best_practice_service import evaluate_best_practices


client = TestClient(app)


def test_evaluate_best_practices_structure():
    """Test evaluate_best_practices returns a valid schema even when live db is unavailable."""
    report = evaluate_best_practices()
    assert hasattr(report, "total_rules")
    assert hasattr(report, "readiness_score")
    assert hasattr(report, "items")
    assert isinstance(report.readiness_score, float)
    assert 0.0 <= report.readiness_score <= 100.0


def test_get_best_practices_endpoint():
    """Test GET /api/toolkit/best-practices endpoint."""
    response = client.get("/api/toolkit/best-practices")
    assert response.status_code == 200
    data = response.json()
    assert "total_rules" in data
    assert "readiness_score" in data
    assert "passed" in data
    assert "warnings" in data
    assert "failed" in data
    assert "items" in data
    assert isinstance(data["items"], list)
