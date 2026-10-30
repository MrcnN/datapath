"""tests/test_toolkit.py — DBA script library endpoint tests."""
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_get_all_scripts():
    res = client.get("/api/toolkit/scripts")
    assert res.status_code == 200
    scripts = res.json()
    assert len(scripts) >= 35
    # Every script must have required fields
    for s in scripts:
        assert "id" in s
        assert "name" in s
        assert "category" in s
        assert "sql" in s
        assert s["risk_level"] in ["read_only", "caution", "destructive"]


def test_search_scripts():
    res = client.get("/api/toolkit/scripts?search=session")
    assert res.status_code == 200
    scripts = res.json()
    assert len(scripts) > 0


def test_get_categories():
    res = client.get("/api/toolkit/categories")
    assert res.status_code == 200
    cats = res.json()
    assert "Oturumlar" in cats
    assert "Engellemeler" in cats
    assert "Bellek & Önbellek" in cats
    assert "Disk & IO" in cats
    assert "Veri Bütünlüğü" in cats
    assert "Güvenlik" in cats
    assert "SQL Agent" in cats
