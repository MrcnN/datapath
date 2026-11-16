"""schemas/latch_spinlock.py — Pydantic schemas for Latch & Spinlock Contention Studio."""
from __future__ import annotations

from typing import List, Optional
from pydantic import BaseModel, Field


class LatchStatItem(BaseModel):
    """Metrics for an individual SQL Server latch class."""

    latch_class: str = Field(..., description="Mandal (Latch) sınıfı")
    waiting_requests_count: int = Field(0, description="Mandalda bekleyen istek sayısı")
    wait_time_ms: int = Field(0, description="Toplam bekleme süresi (ms)")
    avg_wait_ms: float = Field(0.0, description="Ortalama bekleme süresi (ms)")
    max_wait_time_ms: int = Field(0, description="Maksimum bekleme süresi (ms)")
    severity: str = Field("NORMAL", description="CRITICAL, WARNING veya NORMAL")
    description: str = Field("", description="Mandalın koruduğu iç sistem bileşeni açıklaması")
    remediation_hint: str = Field("", description="DBA optimizasyon ipucu")


class SpinlockStatItem(BaseModel):
    """Metrics for an individual SQL Server spinlock."""

    name: str = Field(..., description="Spinlock adı")
    collisions: int = Field(0, description="Çarpışma (collision) sayısı")
    spins: int = Field(0, description="Toplam CPU dönme (spin) sayısı")
    spins_per_collision: float = Field(0.0, description="Çarpışma başına düşen ortalama dönme sayısı")
    sleep_time_ms: int = Field(0, description="Uyuma (backoff/sleep) süresi (ms)")
    backoffs: int = Field(0, description="CPU'yu bırakma (backoff) sayısı")
    severity: str = Field("NORMAL", description="CRITICAL, WARNING veya NORMAL")
    description: str = Field("", description="Spinlock'un kullanım amacı açıklaması")
    remediation_hint: str = Field("", description="DBA optimizasyon ipucu")


class LatchSpinlockSummary(BaseModel):
    """Aggregate summary of kernel latch and spinlock pressure."""

    total_latch_wait_ms: int = Field(0, description="Toplam mandal bekleme süresi (ms)")
    top_latch_class: Optional[str] = Field(None, description="En çok bekleten mandal sınıfı")
    total_spinlock_collisions: int = Field(0, description="Toplam spinlock çarpışma sayısı")
    top_spinlock_name: Optional[str] = Field(None, description="En çok çarpışan spinlock")
    high_collision_spinlocks_count: int = Field(0, description="Yüksek CPU tüketen spinlock sayısı")
    has_cpu_spinlock_pressure: bool = Field(False, description="Spinlock kaynaklı gizli CPU baskısı var mı?")
    evaluated_at: str = Field(..., description="Analiz zaman damgası")


class LatchSpinlockResponse(BaseModel):
    """Response payload for the Latch & Spinlock Contention Studio."""

    summary: LatchSpinlockSummary
    latches: List[LatchStatItem]
    spinlocks: List[SpinlockStatItem]
