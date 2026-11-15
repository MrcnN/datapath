"""schemas/config_drift.py — Pydantic schemas for Multi-Environment Configuration Drift."""
from __future__ import annotations

from typing import List, Optional
from pydantic import BaseModel, Field


class ConfigDriftItem(BaseModel):
    """Represents a specific configuration setting compared against a golden baseline."""

    scope: str = Field(..., description="Kapsam: SERVER veya DATABASE")
    target_name: str = Field(..., description="Örnek (Instance) veya Veritabanı adı")
    setting_name: str = Field(..., description="Konfigürasyon parametre adı")
    category: str = Field(..., description="Kategori: Bellek & Depolama, CPU & Paralellik, Güvenlik & Erişim, Bütünlük, vb.")
    baseline_value: str = Field(..., description="Kurumsal Golden Baseline (Hedef) değeri")
    current_value: str = Field(..., description="Mevcut yapılandırılmış değer")
    in_memory_value: str = Field(..., description="Bellekte çalışan (value_in_use) değer")
    is_reboot_pending: bool = Field(False, description="Yeniden başlatma veya RECONFIGURE bekliyor mu?")
    drift_status: str = Field(..., description="IN_SYNC, DRIFTED_CRITICAL, DRIFTED_WARNING, REBOOT_REQUIRED")
    risk_assessment: str = Field(..., description="Sapmanın yaratabileceği risk ve etki açıklaması")
    remediation_tsql: str = Field(..., description="Sapmayı giderecek T-SQL komutu")


class ConfigDriftSummary(BaseModel):
    """Aggregate summary of configuration drift across the instance."""

    server_name: str = Field(..., description="Sunucu adı")
    baseline_profile: str = Field(..., description="Seçili Golden Baseline profili")
    total_rules_evaluated: int = Field(0, description="Değerlendirilen toplam kural sayısı")
    in_sync_count: int = Field(0, description="Uyumlu (senkronize) kural sayısı")
    drifted_critical_count: int = Field(0, description="Kritik sapma sayısı")
    drifted_warning_count: int = Field(0, description="Uyarı seviyesinde sapma sayısı")
    reboot_pending_count: int = Field(0, description="Yeniden başlatma/RECONFIGURE bekleyen parametre sayısı")
    drift_score_pct: float = Field(100.0, description="Genel uyum skoru (%)")
    evaluated_at: str = Field(..., description="Değerlendirme zaman damgası")


class BaselineProfileMeta(BaseModel):
    """Metadata for an available golden baseline."""

    key: str = Field(..., description="Profil anahtarı")
    label: str = Field(..., description="Profil görünen adı")
    description: str = Field(..., description="Profil açıklaması")


class ConfigDriftResponse(BaseModel):
    """Response payload for Configuration Drift Studio."""

    summary: ConfigDriftSummary
    items: List[ConfigDriftItem]
    available_baselines: List[BaselineProfileMeta]
    full_alignment_script: str
