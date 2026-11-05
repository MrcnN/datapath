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


def test_rbac_matrix_and_switch_role():
    # 1. Get matrix
    response = client.get("/api/permissions/rbac-matrix")
    assert response.status_code == 200
    data = response.json()
    assert "active_role" in data
    assert "roles" in data
    assert "permissions" in data
    assert len(data["permissions"]) >= 5

    # 2. Switch to VIEWER
    res_switch = client.post("/api/permissions/switch-role", json={"new_role": "VIEWER"})
    assert res_switch.status_code == 200
    switch_data = res_switch.json()
    assert switch_data["success"] is True
    assert switch_data["active_role"] == "VIEWER"

    # 3. Verify permissions updated for VIEWER
    res_matrix2 = client.get("/api/permissions/rbac-matrix")
    assert res_matrix2.status_code == 200
    m2 = res_matrix2.json()
    assert m2["active_role"] == "VIEWER"
    assert m2["can_generate_tsql_remedies"] is False
    assert m2["can_export_dossier"] is False

    # 4. Switch back to SENIOR_DBA
    res_reset = client.post("/api/permissions/switch-role", json={"new_role": "SENIOR_DBA"})
    assert res_reset.status_code == 200
    assert res_reset.json()["active_role"] == "SENIOR_DBA"
