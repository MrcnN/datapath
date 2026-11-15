"""schemas/ddl_audit.py — Pydantic schemas for DDL Audit & Schema Change Timeline."""
from __future__ import annotations

from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field


class DDLActionType(str, Enum):
    CREATE = "CREATE"
    ALTER = "ALTER"
    DROP = "DROP"


class DDLObjectType(str, Enum):
    TABLE = "TABLE"
    INDEX = "INDEX"
    STORED_PROCEDURE = "STORED_PROCEDURE"
    VIEW = "VIEW"
    TRIGGER = "TRIGGER"
    FUNCTION = "FUNCTION"
    DATABASE = "DATABASE"
    SCHEMA = "SCHEMA"
    OBJECT = "OBJECT"


class DDLRiskLevel(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class DDLEventItem(BaseModel):
    event_id: str = Field(..., description="Olay tekil kimliği")
    event_time: str = Field(..., description="Olayın gerçekleştiği tarih ve saat")
    action_type: DDLActionType = Field(..., description="DDL eylem türü (CREATE, ALTER, DROP)")
    object_type: DDLObjectType = Field(..., description="Etkilenen nesne türü")
    object_name: str = Field(..., description="Nesne adı")
    schema_name: Optional[str] = Field(default="dbo", description="Şema adı")
    database_name: str = Field(..., description="Veritabanı adı")
    login_name: str = Field(..., description="İşlemi yürüten SQL/Windows oturumu")
    host_name: Optional[str] = Field(default=None, description="İstemci makine adı")
    application_name: Optional[str] = Field(default=None, description="Değişikliği tetikleyen istemci uygulama")
    session_id: Optional[int] = Field(default=None, description="SPID oturum numarası")
    risk_level: DDLRiskLevel = Field(default=DDLRiskLevel.LOW, description="Değişikliğin sistem riski")
    impact_summary: str = Field(..., description="Operasyonel risk ve etki özeti")
    remediation_or_rollback_hint: Optional[str] = Field(default=None, description="Geri alma veya inceleme tavsiyesi")


class DDLAuditSummary(BaseModel):
    total_events: int = Field(..., description="Toplam kaydedilen DDL olayı")
    create_count: int = Field(..., description="Oluşturma (CREATE) sayısı")
    alter_count: int = Field(..., description="Değiştirme (ALTER) sayısı")
    drop_count: int = Field(..., description="Silme (DROP) sayısı")
    critical_changes_count: int = Field(..., description="Kritik veya yüksek riskli değişiklik sayısı")
    unique_users_count: int = Field(..., description="DDL çalıştıran farklı kullanıcı sayısı")
    affected_databases: List[str] = Field(default_factory=list, description="Değişiklik gören veritabanları")
    last_change_time: Optional[str] = Field(default=None, description="Son DDL olayının zamanı")


class DDLAuditResponse(BaseModel):
    summary: DDLAuditSummary
    events: List[DDLEventItem]
    source: str = Field(default="DEFAULT_TRACE", description="Veri kaynağı (DEFAULT_TRACE veya EXTENDED_EVENTS)")
    is_trace_active: bool = Field(default=True, description="SQL Server Default Trace mekanizması devrede mi?")
    evaluated_at: str = Field(..., description="Sorgulama zamanı")
