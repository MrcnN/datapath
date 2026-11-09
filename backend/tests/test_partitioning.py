"""tests/test_partitioning.py — Unit tests for Table Partitioning & Sliding Window Lifecycle Advisor."""
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_partitioning_overview_endpoint():
    response = client.get("/api/partitioning/overview?database=Datapath_TestDB")
    assert response.status_code == 200
    data = response.json()
    assert "database_name" in data
    assert "total_partitioned_tables" in data
    assert "total_candidate_tables" in data
    assert "candidates" in data
    assert "partitioned_tables" in data
    assert isinstance(data["candidates"], list)
    assert isinstance(data["partitioned_tables"], list)


def test_generate_partition_script_yearly():
    payload = {
        "database_name": "Datapath_TestDB",
        "table_name": "Orders",
        "schema_name": "dbo",
        "key_column": "OrderDate",
        "key_type": "DATETIME2",
        "boundary_interval": "YEARLY",
        "start_year": 2024,
        "end_year": 2027,
        "filegroup": "PRIMARY",
    }
    response = client.post("/api/partitioning/generate-script", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["table_name"] == "Orders"
    assert "pf_Orders_yearly" in data["partition_function_name"]
    assert "ps_Orders_yearly" in data["partition_scheme_name"]
    assert "CREATE PARTITION FUNCTION" in data["ddl_create_scheme_sql"]
    assert "CREATE PARTITION SCHEME" in data["ddl_create_scheme_sql"]
    assert "CREATE CLUSTERED INDEX" in data["ddl_rebuild_table_sql"]
    assert "ONLINE = ON" in data["ddl_rebuild_table_sql"]
    assert "SPLIT RANGE" in data["sliding_window_split_sql"]
    assert "SWITCH PARTITION" in data["switch_archive_sql"]
    assert len(data["architectural_notes"]) > 0


def test_generate_partition_script_monthly():
    payload = {
        "database_name": "Datapath_TestDB",
        "table_name": "Invoices",
        "schema_name": "dbo",
        "key_column": "InvoiceDate",
        "key_type": "DATETIME2",
        "boundary_interval": "MONTHLY",
        "start_year": 2025,
        "end_year": 2026,
        "filegroup": "PRIMARY",
    }
    response = client.post("/api/partitioning/generate-script", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["table_name"] == "Invoices"
    assert "pf_Invoices_monthly" in data["partition_function_name"]
    assert "ps_Invoices_monthly" in data["partition_scheme_name"]
    assert "SPLIT RANGE" in data["sliding_window_split_sql"]
    assert "SWITCH PARTITION" in data["switch_archive_sql"]
