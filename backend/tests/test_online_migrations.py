"""tests/test_online_migrations.py — Unit tests for Zero-Downtime Online Schema Migration Studio."""
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_get_candidate_tables():
    response = client.get("/api/online-migrations/tables?database=Datapath_TestDB")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) > 0
    first = data[0]
    assert "table_name" in first
    assert "total_rows" in first
    assert "migration_risk_level" in first
    assert "recommendation_tip" in first


def test_get_table_details():
    response = client.get("/api/online-migrations/table-details?table=Orders&schema=dbo&database=Datapath_TestDB")
    assert response.status_code == 200
    data = response.json()
    assert data["table_name"] == "Orders"
    assert "columns" in data
    assert "indexes" in data
    assert len(data["columns"]) > 0


def test_generate_runbook_add_not_null():
    payload = {
        "database_name": "Datapath_TestDB",
        "table_name": "Orders",
        "schema_name": "dbo",
        "pattern": "ADD_NOT_NULL_COLUMN",
        "new_column_name": "PaymentStatus",
        "new_data_type": "VARCHAR(30)",
        "default_value": "'PAID'",
        "batch_size": 2500,
        "throttle_delay_ms": 30,
    }
    response = client.post("/api/online-migrations/generate-runbook", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["table_name"] == "Orders"
    assert data["pattern"] == "ADD_NOT_NULL_COLUMN"
    assert "comparison" in data
    assert len(data["phases"]) == 5
    assert "PaymentStatus" in data["phases"][0]["sql_script"]
    assert "WAITFOR DELAY" in data["phases"][2]["sql_script"]
    assert "emergency_rollback_sql" in data


def test_generate_runbook_column_type_evolution():
    payload = {
        "database_name": "Datapath_TestDB",
        "table_name": "Invoices",
        "schema_name": "dbo",
        "pattern": "COLUMN_TYPE_EVOLUTION",
        "target_column": "TotalAmount",
        "new_data_type": "DECIMAL(18, 4)",
        "batch_size": 5000,
        "throttle_delay_ms": 50,
    }
    response = client.post("/api/online-migrations/generate-runbook", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["pattern"] == "COLUMN_TYPE_EVOLUTION"
    assert "sp_rename" in data["phases"][4]["sql_script"]
