"""tests/test_rca_report.py — Test Incident Root-Cause Analysis (RCA) Post-Mortem Generator."""
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.schemas.rca_report import RCARequest
from app.services.rca_service import generate_rca_post_mortem

client = TestClient(app)


def test_generate_rca_deadlock():
    """Test generating deadlock post-mortem report."""
    req = RCARequest(
        incident_type="DEADLOCK",
        database="ProductionDB",
        spids=[55, 62],
    )
    report = generate_rca_post_mortem(req)
    assert "RCA-" in report.report_id
    assert report.severity == "HIGH"
    assert "Deadlock" in report.incident_title
    assert len(report.timeline) >= 3
    assert len(report.corrective_actions) >= 2
    assert "READ_COMMITTED_SNAPSHOT" in report.remediation_tsql
    assert "# Olay Kök Neden Analizi" in report.markdown_content


def test_generate_rca_endpoint():
    """Test POST /api/incidents/generate-rca endpoint."""
    response = client.post(
        "/api/incidents/generate-rca",
        json={
            "incident_type": "BLOCKING_STORM",
            "database": "SalesDB",
            "spids": [101, 102, 105],
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert "report_id" in data
    assert data["severity"] == "CRITICAL"
    assert "Kilitlenme" in data["incident_title"]
    assert "timeline" in data
    assert "corrective_actions" in data
