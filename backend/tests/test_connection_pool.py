import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_get_connection_pool_summary():
    """Bağlantı havuzu ve zombie transaction özetinin başarılı dönüşü."""
    response = client.get("/api/connection-sentinel/summary")
    assert response.status_code == 200
    data = response.json()
    assert "total_connections" in data
    assert "active_sessions" in data
    assert "sleeping_sessions" in data
    assert "orphaned_sleeping_transactions_count" in data
    assert "top_client_groups" in data
    assert isinstance(data["top_client_groups"], list)
    assert "sleeping_transactions" in data
    assert isinstance(data["sleeping_transactions"], list)
    assert "diagnostic_verdict" in data


def test_get_kill_script_valid_session():
    """Geçerli bir kullanıcı oturumu (SPID > 50) için sonlandırma ve kilit betiği üretimi."""
    response = client.get("/api/connection-sentinel/kill-script/74")
    assert response.status_code == 200
    data = response.json()
    assert data["session_id"] == 74
    assert "KILL 74;" in data["kill_command"]
    assert "sys.dm_tran_locks" in data["investigation_sql"]


def test_get_kill_script_system_session_rejected():
    """Sistem oturumları (SPID <= 50) için sonlandırma isteğinin 400 ile reddedilmesi."""
    response = client.get("/api/connection-sentinel/kill-script/12")
    assert response.status_code == 400
    assert "sistem süreçleridir" in response.json()["detail"]
