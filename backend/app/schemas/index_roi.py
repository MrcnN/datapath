from pydantic import BaseModel, Field
from typing import List, Optional


class IndexRoiItem(BaseModel):
    database_name: str
    schema_name: str
    table_name: str
    index_name: str
    index_type: str
    is_unique: bool = False
    user_seeks: int = 0
    user_scans: int = 0
    user_lookups: int = 0
    total_reads: int = 0
    total_writes: int = 0
    write_to_read_ratio: float = Field(0.0, description="Yazma/Okuma oranı (Yüksek değer ağır yazma cezası demektir)")
    size_mb: float = 0.0
    row_count: int = 0
    page_lock_wait_count: int = 0
    page_io_latch_wait_in_ms: float = 0.0
    roi_score: float = Field(..., description="-100 ile +100 arası İndeks Yatırım Getirisi (ROI) Skoru")
    classification: str = Field(..., description="CRITICAL_BOTTLENECK | NEGATIVE_ROI | LOW_ROI | OPTIMAL_ROI")
    key_columns: str = ""
    included_columns: Optional[str] = None
    verdict_reason: str
    recommended_action: str = Field(..., description="DROP | COMPRESS_PAGE | KEEP | CONSOLIDATE")
    drop_script: str
    rollback_create_script: str


class IndexRoiOverview(BaseModel):
    database_name: str
    is_demo: bool = False
    total_evaluated_indexes: int
    negative_roi_count: int
    wasted_write_iops_total: int
    reclaimable_storage_mb: float
    overall_efficiency_score: float
    items: List[IndexRoiItem] = []
    executive_summary: str
