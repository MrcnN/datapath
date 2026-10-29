"""tests/test_servers.py — Tests for multi-server profile registry using actual configured settings."""
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_list_servers():
    response = client.get("/api/servers")
    assert response.status_code == 200
    data = response.json()
    assert "active_server_id" in data
    assert data["total_count"] >= 1
    assert len(data["servers"]) >= 1
    # Check default server presence
    ids = [s["id"] for s in data["servers"]]
    assert "srv-default" in ids


def test_get_active_server():
    response = client.get("/api/servers/active")
    assert response.status_code == 200
    data = response.json()
    assert data["is_active"] is True
    assert "host" in data
    assert "environment" in data


def test_add_activate_and_delete_server():
    new_server = {
        "name": "Local-Test-Server",
        "host": "localhost",
        "port": 1433,
        "default_database": "master",
        "username": None,
        "password": None,
        "use_windows_auth": True,
        "environment": "DEVELOPMENT",
        "role": "Test Sunucusu",
        "driver": "ODBC Driver 17 for SQL Server",
        "timeout": 5,
        "description": "Birim test sunucusu.",
    }
    create_res = client.post("/api/servers", json=new_server)
    assert create_res.status_code == 201
    created = create_res.json()
    created_id = created["id"]
    assert created["name"] == "Local-Test-Server"

    # Activate created server
    act_res = client.post(f"/api/servers/{created_id}/activate")
    assert act_res.status_code == 200
    assert act_res.json()["is_active"] is True

    # Switch back to srv-default
    switch_back = client.post("/api/servers/srv-default/activate")
    assert switch_back.status_code == 200

    # Delete the created server
    del_res = client.delete(f"/api/servers/{created_id}")
    assert del_res.status_code == 200
    assert del_res.json()["status"] == "success"

    # Confirm it cannot be pinged or activated
    ping_res = client.post(f"/api/servers/{created_id}/ping")
    assert ping_res.status_code == 404


def test_activate_server_not_found():
    response = client.post("/api/servers/srv-nonexistent/activate")
    assert response.status_code == 404


def test_ping_server():
    response = client.post("/api/servers/srv-default/ping")
    assert response.status_code == 200
    data = response.json()
    assert data["server_id"] == "srv-default"
    assert "is_online" in data
    assert "latency_ms" in data
    assert "checked_at" in data
