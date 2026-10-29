"""tests/test_permissions.py — Unit tests for Logins, Roles, and Security & Vulnerability Audit."""
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_logins_endpoint():
    response = client.get("/api/permissions/logins")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


def test_roles_endpoint():
    response = client.get("/api/permissions/roles")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


def test_security_audit_endpoint():
    response = client.get("/api/permissions/audit")
    assert response.status_code == 200
    data = response.json()
    assert "security_score" in data
    assert "critical_count" in data
    assert "warning_count" in data
    assert "findings" in data
    assert "hardening_script" in data
    assert isinstance(data["findings"], list)
    if data["findings"]:
        f = data["findings"][0]
        assert "id" in f
        assert "severity" in f
        assert "category" in f
        assert "remediation_sql" in f
