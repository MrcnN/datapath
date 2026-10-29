"""schemas/servers.py — Pydantic schemas for multi-server profiles and environment management."""
from __future__ import annotations

from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field


class EnvironmentType(str, Enum):
    PRODUCTION = "PRODUCTION"
    READ_ONLY_REPLICA = "READ_ONLY_REPLICA"
    STAGING = "STAGING"
    DEVELOPMENT = "DEVELOPMENT"
    DISASTER_RECOVERY = "DISASTER_RECOVERY"


class ServerProfileBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=100, description="Sunucu/küme adı veya tanımlayıcı")
    host: str = Field(..., min_length=1, description="Sunucu ana makine adı, IP adresi veya SQL Instance adı")
    port: int = Field(default=1433, ge=1, le=65535, description="SQL Server TCP portu")
    default_database: str = Field(default="master", description="Varsayılan başlangıç veritabanı")
    username: Optional[str] = Field(default=None, description="SQL Server kullanıcı adı")
    use_windows_auth: bool = Field(default=False, description="Windows Tümleşik Kimlik Doğrulaması kullan")
    environment: EnvironmentType = Field(default=EnvironmentType.PRODUCTION, description="Ortam türü")
    role: str = Field(default="Primary Node", description="Sunucu rolü (Primary, Secondary Replica, Standby vb.)")
    driver: str = Field(default="ODBC Driver 17 for SQL Server", description="ODBC Sürücüsü")
    timeout: int = Field(default=15, ge=1, le=120, description="Bağlantı zaman aşımı (saniye)")
    description: Optional[str] = Field(default=None, description="Sunucu açıklaması veya notlar")


class ServerProfileCreate(ServerProfileBase):
    password: Optional[str] = Field(default=None, description="SQL Server şifresi (opsiyonel)")


class ServerProfileUpdate(BaseModel):
    name: Optional[str] = None
    host: Optional[str] = None
    port: Optional[int] = None
    default_database: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    use_windows_auth: Optional[bool] = None
    environment: Optional[EnvironmentType] = None
    role: Optional[str] = None
    timeout: Optional[int] = None
    description: Optional[str] = None


class ServerProfile(ServerProfileBase):
    id: str = Field(..., description="Benzersiz sunucu profil kimliği")
    is_active: bool = Field(default=False, description="Şu an aktif olarak seçili sunucu mu?")
    is_online: bool = Field(default=True, description="Sunucu erişilebilir durumda mı?")
    latency_ms: Optional[float] = Field(default=None, description="Son ölçülen ağ gecikmesi (ms)")
    version: Optional[str] = Field(default=None, description="SQL Server sürüm metni")
    edition: Optional[str] = Field(default=None, description="SQL Server sürüm paketi (Enterprise, Standard vb.)")
    cpu_count: Optional[int] = Field(default=None, description="Mantıksal CPU çekirdek sayısı")
    total_memory_gb: Optional[float] = Field(default=None, description="Toplam atanmış/fiziksel bellek (GB)")


class ServerProfileListResponse(BaseModel):
    active_server_id: str = Field(..., description="Aktif profil kimliği")
    total_count: int = Field(..., description="Toplam kayıtlı sunucu sayısı")
    servers: List[ServerProfile] = Field(..., description="Kayıtlı sunucu profilleri listesi")


class ServerPingResponse(BaseModel):
    server_id: str
    server_name: str
    is_online: bool
    latency_ms: float
    message: str
    checked_at: str
