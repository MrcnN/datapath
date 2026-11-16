"""schemas/memory_grants.py — Pydantic schemas for Memory Grant Starvation & Resource Semaphore Studio."""
from __future__ import annotations

from typing import List, Optional
from pydantic import BaseModel, Field


class ResourceSemaphoreStatus(BaseModel):
    """Status of a SQL Server query execution resource semaphore."""

    semaphore_id: int = Field(..., description="Semafor ID (0: Normal, 1: Küçük Sorgular)")
    total_memory_mb: float = Field(0.0, description="Semafor toplam tahsis edilebilir bellek (MB)")
    available_memory_mb: float = Field(0.0, description="Kullanılabilir boş bellek (MB)")
    granted_memory_mb: float = Field(0.0, description="Sorgulara verilmiş bellek (MB)")
    used_memory_mb: float = Field(0.0, description="Fiilen kullanılan bellek (MB)")
    grantee_count: int = Field(0, description="Bellek almış aktif çalışan sorgu sayısı")
    waiter_count: int = Field(0, description="RESOURCE_SEMAPHORE kuyruğunda bekleyen sorgu sayısı")
    timeout_error_count: int = Field(0, description="Bellek bekleme zaman aşımı (Timeout Error 8645) sayısı")
    forced_grant_count: int = Field(0, description="Zorunlu minimum bellek tahsis sayısı")
    utilization_pct: float = Field(0.0, description="Bellek tahsis doluluk yüzdesi (%)")


class LiveMemoryGrantItem(BaseModel):
    """A currently executing or queued query memory grant request."""

    session_id: int = Field(..., description="SPID")
    request_id: int = Field(..., description="Request ID")
    scheduler_id: int = Field(..., description="CPU Scheduler ID")
    dop: int = Field(1, description="Degree of Parallelism (DOP)")
    requested_memory_mb: float = Field(0.0, description="Talep edilen bellek (MB)")
    granted_memory_mb: float = Field(0.0, description="Verilen bellek (MB)")
    required_memory_mb: float = Field(0.0, description="Asgari zorunlu bellek (MB)")
    used_memory_mb: float = Field(0.0, description="Şu an kullanılan bellek (MB)")
    max_used_memory_mb: float = Field(0.0, description="Ulaşılan maksimum bellek (MB)")
    ideal_memory_mb: float = Field(0.0, description="Optimizer ideal bellek tahmini (MB)")
    query_cost: float = Field(0.0, description="Sorgu tahmini maliyeti (Cost)")
    wait_time_ms: int = Field(0, description="RESOURCE_SEMAPHORE kuyruk bekleme süresi (ms)")
    wait_order: Optional[int] = Field(None, description="Kuyruktaki bekleme sırası")
    is_next_candidate: bool = Field(False, description="Sıradaki bellek alacak sorgu adayı mı?")
    status: str = Field("GRANTED", description="GRANTED veya WAITING (RESOURCE_SEMAPHORE)")
    query_text: str = Field("", description="Sorgu SQL metni")
    remediation_hint: str = Field("", description="T-SQL iyileştirme ipucu")


class HistoricalMemoryWasterItem(BaseModel):
    """Historical query from sys.dm_exec_query_stats wasting memory grants or spilling."""

    execution_count: int = Field(..., description="Toplam yürütme sayısı")
    max_grant_mb: float = Field(0.0, description="Maksimum verilen bellek (MB)")
    avg_grant_mb: float = Field(0.0, description="Ortalama verilen bellek (MB)")
    max_used_grant_mb: float = Field(0.0, description="Maksimum fiili kullanılan bellek (MB)")
    avg_used_grant_mb: float = Field(0.0, description="Ortalama fiili kullanılan bellek (MB)")
    wasted_grant_pct: float = Field(0.0, description="Boşa ayrılan bellek oranı (%)")
    total_spills: int = Field(0, description="TempDB Sort/Hash taşma sayısı")
    query_text: str = Field("", description="Sorgu SQL metni")
    diagnostic_verdict: str = Field("", description="Kardinalite sapması veya taşma teşhisi")
    remediation_tsql: str = Field("", description="Önerilen düzeltme T-SQL betiği")


class MemoryGrantSummary(BaseModel):
    """Aggregate summary of memory grant health across the SQL Server instance."""

    server_name: str = Field(..., description="Sunucu adı")
    total_workspace_memory_mb: float = Field(0.0, description="Toplam workspace bellek (MB)")
    available_workspace_memory_mb: float = Field(0.0, description="Boş workspace bellek (MB)")
    active_grants_count: int = Field(0, description="Aktif çalışan bellek tahsisleri")
    queued_waiters_count: int = Field(0, description="RESOURCE_SEMAPHORE bekleyen sorgular")
    has_memory_starvation: bool = Field(False, description="RESOURCE_SEMAPHORE kuyruğu veya açlık var mı?")
    top_wasted_grant_mb: float = Field(0.0, description="En büyük israf edilen bellek (MB)")
    total_spilling_queries_count: int = Field(0, description="TempDB'ye taşan sorgu sayısı")
    evaluated_at: str = Field(..., description="Analiz zaman damgası")


class MemoryGrantResponse(BaseModel):
    """Complete payload for Memory Grant Studio."""

    summary: MemoryGrantSummary
    semaphores: List[ResourceSemaphoreStatus]
    live_grants: List[LiveMemoryGrantItem]
    historical_wasters: List[HistoricalMemoryWasterItem]
