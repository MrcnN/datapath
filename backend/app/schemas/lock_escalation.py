"""schemas/lock_escalation.py — Pydantic schemas for Lock Escalation and Contention Heatmap."""
from __future__ import annotations

from typing import List, Optional
from pydantic import BaseModel, Field


class LockContentionItem(BaseModel):
    """Forensic lock contention and escalation metrics for a specific table/index."""

    database_name: str = Field(..., description="Veritabanı adı")
    schema_name: str = Field(..., description="Şema adı")
    table_name: str = Field(..., description="Tablo adı")
    index_name: str = Field(..., description="İndeks adı veya (HEAP)")
    index_type: str = Field(..., description="İndeks tipi (CLUSTERED, NONCLUSTERED, HEAP)")
    partition_number: int = Field(1, description="Bölüm numarası")
    
    # Row lock statistics
    row_lock_count: int = Field(0, description="Talep edilen satır kilidi sayısı")
    row_lock_wait_count: int = Field(0, description="Satır kilidi bekleme sayısı")
    row_lock_wait_ms: int = Field(0, description="Satır kilidi toplam bekleme süresi (ms)")
    
    # Page lock statistics
    page_lock_count: int = Field(0, description="Talep edilen sayfa kilidi sayısı")
    page_lock_wait_count: int = Field(0, description="Sayfa kilidi bekleme sayısı")
    page_lock_wait_ms: int = Field(0, description="Sayfa kilidi toplam bekleme süresi (ms)")
    
    total_lock_wait_ms: int = Field(0, description="Toplam satır ve sayfa kilit bekleme süresi (ms)")
    
    # Escalation metrics
    escalation_attempt_count: int = Field(0, description="Kilit yükseltme (escalation) deneme sayısı")
    escalation_count: int = Field(0, description="Başarılı kilit yükseltme sayısı (Table Lock)")
    escalation_rate_pct: float = Field(0.0, description="Kilit yükseltme başarı oranı (%)")
    
    # Latch metrics (memory / disk contention)
    page_latch_wait_ms: int = Field(0, description="Bellek içi sayfa mandal beklemesi (ms)")
    page_io_latch_wait_ms: int = Field(0, description="Disk G/Ç sayfa mandal beklemesi (ms)")
    
    # Configuration and Advice
    lock_escalation_setting: str = Field("TABLE", description="Mevcut lock_escalation ayarı (TABLE, AUTO, DISABLE)")
    contention_severity: str = Field("HEALTHY", description="Çakışma seviyesi: CRITICAL, WARNING, MODERATE, HEALTHY")
    diagnostic_verdict: str = Field("", description="Detaylı Türkçe tespit ve etki analizi")
    remediation_tsql: str = Field("", description="DBA incelemesi için önerilen T-SQL betiği")


class LockEscalationSummary(BaseModel):
    """Aggregate summary of lock contention across the instance/database."""

    total_objects_analyzed: int = Field(0, description="Taranan tablo/indeks sayısı")
    contended_objects_count: int = Field(0, description="Kilit çakışması yaşayan nesne sayısı")
    escalated_objects_count: int = Field(0, description="Kilit yükseltmesi (Table Lock) yaşayan nesne sayısı")
    total_escalation_count: int = Field(0, description="Toplam kilit yükseltme olayı")
    total_lock_wait_ms: int = Field(0, description="Kümülatif kilit bekleme süresi (ms)")
    top_contended_object: Optional[str] = Field(None, description="En yüksek kilit çakışmasına sahip nesne")
    analyzed_at: str = Field(..., description="Analiz zaman damgası")


class LockEscalationResponse(BaseModel):
    """Complete response payload for the Lock Escalation Studio."""

    summary: LockEscalationSummary
    items: List[LockContentionItem]
    active_database: str
