import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_get_index_roi_overview_success():
    """İndeks ROI özetinin ve sınıflandırmalarının başarılı dönüşü."""
    response = client.get("/api/index-roi/overview?database=Datapath_TestDB")
    assert response.status_code == 200
    data = response.json()
    assert "database_name" in data
    assert "total_evaluated_indexes" in data
    assert "negative_roi_count" in data
    assert "wasted_write_iops_total" in data
    assert "reclaimable_storage_mb" in data
    assert "overall_efficiency_score" in data
    assert "items" in data
    assert isinstance(data["items"], list)
    assert len(data["items"]) > 0
    
    first_item = data["items"][0]
    assert "index_name" in first_item
    assert "roi_score" in first_item
    assert "write_to_read_ratio" in first_item
    assert "classification" in first_item
    assert "recommended_action" in first_item
    assert "drop_script" in first_item
    assert "rollback_create_script" in first_item


def test_get_index_roi_overview_empty_param():
    """Parametre verilmediğinde de varsayılan veritabanı üzerinden sorunsuz dönüş."""
    response = client.get("/api/index-roi/overview")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
