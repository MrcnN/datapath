"""tests/test_servers.py — Tests for multi-server profile registry and switching."""
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_list_servers():
    response = client.get("/api/servers")
    assert response.status_code == 200
    data = response.json()
    assert "active_server_id" in data
    assert data["total_count"] >= 4
    assert len(data["servers"]) >= 4
    # Check default server presence
    ids = [s["id"] for s in data["servers"]]
    assert "srv-prod-primary" in ids
    assert "srv-prod-replica" in ids
    assert "srv-staging" in ids
    assert "srv-dev-local" in ids


def test_get_active_server():
    response = client.get("/api/servers/active")
    assert response.status_code == 200
    data = response.json()
    assert data["is_active"] is True
    assert "host" in data
    assert "environment" in data


def test_activate_server():
    # Activate replica
    response = client.post("/api/servers/srv-prod-replica/activate")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == "srv-prod-replica"
    assert data["is_active"] is True

    # Check that active server id updated in list
    list_res = client.get("/api/servers")
    assert list_res.status_code == 200
    assert list_res.json()["active_server_id"] == "srv-prod-replica"

    # Switch back to primary
    switch_back = client.post("/api/servers/srv-prod-primary/activate")
    assert switch_back.status_code == 200
    assert switch_back.json()["id"] == "srv-prod-primary"


def test_activate_server_not_found():
    response = client.post("/api/servers/srv-nonexistent/activate")
    assert response.status_code == 404


def test_ping_server():
    response = client.post("/api/servers/srv-prod-primary/ping")
    assert response.status_code == 200
    data = response.json()
    assert data["server_id"] == "srv-prod-primary"
    assert data["is_online"] is True
    assert data["latency_ms"] > 0
    assert "checked_at" in data


def test_add_and_delete_server():
    new_server = {
        "name": "SQL-ANALYTICS-01",
        "host": "sql-analytics.corp.internal",
        "port": 1433,
        "default_database": "Warehouse",
        "username": "bi_user",
        "password": "SecretPassword123!",
        "use_windows_auth": False,
        "environment": "PRODUCTION",
        "role": "Data Warehouse Replica",
        "driver": "ODBC Driver 17 for SQL Server",
        "timeout": 15,
        "description": "Büyük veri ve OLAP analitik ambar sunucusu.",
    }
    create_res = client.post("/api/servers", json=new_server)
    assert create_res.status_code == 201
    created = create_res.json()
    created_id = created["id"]
    assert created["name"] == "SQL-ANALYTICS-01"
    assert created["environment"] == "PRODUCTION"

    # Delete the created server
    del_res = client.delete(f"/api/servers/{created_id}")
    assert del_res.status_code == 200
    assert del_res.json()["status"] == "success"

    # Confirm it cannot be pinged/activated
    ping_res = client.post(f"/api/servers/{created_id}/ping")
    assert ping_res.status_code == 404
