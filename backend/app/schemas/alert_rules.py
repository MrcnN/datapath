"""schemas/alert_rules.py — Pydantic schemas for Custom Alert Rules & Threshold Engine."""
from __future__ import annotations

from enum import Enum
from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field


class AlertMetric(str, Enum):
    CPU_UTILIZATION = "CPU_UTILIZATION"
    MEMORY_PRESSURE = "MEMORY_PRESSURE"
    DISK_FREE_SPACE_PCT = "DISK_FREE_SPACE_PCT"
    BLOCKING_DURATION_SEC = "BLOCKING_DURATION_SEC"
    DEADLOCK_RATE_PER_MIN = "DEADLOCK_RATE_PER_MIN"
    CONNECTION_POOL_PCT = "CONNECTION_POOL_PCT"
    TEMPDB_UTILIZATION_PCT = "TEMPDB_UTILIZATION_PCT"
    LONGEST_TRANSACTION_SEC = "LONGEST_TRANSACTION_SEC"
    PAGE_LIFE_EXPECTANCY = "PAGE_LIFE_EXPECTANCY"
    BUFFER_CACHE_HIT_RATIO = "BUFFER_CACHE_HIT_RATIO"


class AlertOperator(str, Enum):
    GT = ">"
    LT = "<"
    GTE = ">="
    LTE = "<="
    EQ = "=="


class AlertSeverity(str, Enum):
    CRITICAL = "CRITICAL"
    WARNING = "WARNING"
    INFO = "INFO"


class AlertStatus(str, Enum):
    NORMAL = "NORMAL"
    TRIGGERED = "TRIGGERED"
    MUTED = "MUTED"
    DISABLED = "DISABLED"


class AlertChannel(str, Enum):
    WEBHOOK = "webhook"
    EMAIL = "email"
    IN_APP = "in_app"


class AlertRuleBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=120, description="Kuralın anlaşılır adı")
    metric: AlertMetric = Field(..., description="İzlenen sistem metriği")
    operator: AlertOperator = Field(default=AlertOperator.GT, description="Karşılaştırma operatörü")
    threshold: float = Field(..., description="Tetiklenme eşik değeri")
    unit: str = Field(default="%", max_length=15, description="Birim (%, s, adet vb.)")
    severity: AlertSeverity = Field(default=AlertSeverity.WARNING, description="Kriz ciddiyet seviyesi")
    duration_seconds: int = Field(default=60, ge=0, le=86400, description="Eşiğin aşılı kalması gereken minimum süre (saniye)")
    cooldown_minutes: int = Field(default=15, ge=1, le=1440, description="Tekrar bildirim gönderme bekleme süresi")
    is_enabled: bool = Field(default=True, description="Kural etkin mi?")
    notify_channels: List[str] = Field(default_factory=lambda: ["webhook", "in_app"], description="Bildirim kanalları")
    description: Optional[str] = Field(default=None, description="Kuralın detayı veya tetiklenme senaryosu")
    remediation_hint: Optional[str] = Field(default=None, description="DBA için operasyonel çözüm önerisi")


class AlertRuleCreate(AlertRuleBase):
    pass


class AlertRule(AlertRuleBase):
    id: str = Field(..., description="Benzersiz kural kimliği")
    created_at: str = Field(..., description="Oluşturulma zamanı")
    updated_at: str = Field(..., description="Son güncelleme zamanı")


class ActiveAlert(BaseModel):
    rule_id: str
    rule_name: str
    metric: AlertMetric
    severity: AlertSeverity
    current_value: float
    threshold: float
    unit: str
    operator: AlertOperator
    status: AlertStatus
    triggered_at: str
    breach_duration_sec: int
    message: str
    remediation_hint: Optional[str] = None
    server_name: str = "SQL-INSTANCE-01"


class AlertRuleEvaluationSummary(BaseModel):
    rule_id: str
    rule_name: str
    metric: AlertMetric
    operator: AlertOperator
    threshold: float
    unit: str
    current_value: float
    is_breached: bool
    status: AlertStatus
    severity: AlertSeverity


class AlertEvaluationResult(BaseModel):
    server_name: str
    evaluated_at: str
    total_rules: int
    active_rules: int
    triggered_count: int
    critical_count: int
    warning_count: int
    alerts: List[ActiveAlert]
    evaluations: List[AlertRuleEvaluationSummary]
    webhook_enabled: bool
    webhook_service: Optional[str] = None


class AlertSimulationRequest(BaseModel):
    rule_id: Optional[str] = None
    metric: AlertMetric = AlertMetric.CPU_UTILIZATION
    mock_value: float = 94.5
    send_webhook: bool = False


class AlertSimulationResponse(BaseModel):
    success: bool
    rule_name: str
    is_breached: bool
    message: str
    webhook_dispatched: bool
    webhook_status_code: Optional[int] = None
    telemetry_snapshot: Dict[str, Any]
