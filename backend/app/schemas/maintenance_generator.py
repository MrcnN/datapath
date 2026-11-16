"""schemas/maintenance_generator.py — Ola Hallengren & Native SQL Agent Maintenance Generator models."""
from __future__ import annotations

from typing import List, Optional, Literal
from pydantic import BaseModel, Field


class CommandLogEntry(BaseModel):
    id: int
    database_name: Optional[str] = None
    schema_name: Optional[str] = None
    object_name: Optional[str] = None
    command_type: Optional[str] = None
    command: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    error_number: Optional[int] = 0
    error_message: Optional[str] = None


class MaintenanceInstalledComponent(BaseModel):
    name: str
    database: str
    object_type: str
    create_date: Optional[str] = None
    modify_date: Optional[str] = None
    is_installed: bool = False


class MaintenanceExistingJob(BaseModel):
    job_id: str
    name: str
    enabled: bool
    description: Optional[str] = None
    date_created: Optional[str] = None
    last_run_date: Optional[str] = None
    last_run_status: Optional[str] = None


class MaintenanceStatusResponse(BaseModel):
    is_ola_installed: bool
    target_database: str
    components: List[MaintenanceInstalledComponent]
    installed_count: int
    total_components: int
    has_command_log: bool
    recent_errors_count: int
    recent_executions: List[CommandLogEntry]
    existing_maintenance_jobs: List[MaintenanceExistingJob]
    sql_edition: str
    supports_online_rebuild: bool
    supports_resumable_rebuild: bool


class MaintenanceJobGenerateRequest(BaseModel):
    solution_type: Literal["OLA_HALLENGREN", "NATIVE_TSQL"] = "OLA_HALLENGREN"
    target_database: str = Field(default="master", description="Ola Hallengren nesnelerinin kurulu olduğu/olacağı veritabanı (örn. master veya DBA)")
    backup_directory: str = Field(default="C:\\SQLBackups", description="Yedeklerin saklanacağı disk veya SMB paylaşım dizini")
    backup_retention_hours: int = Field(default=168, description="Yedek saklama süresi (saat cinsinden; varsayılan 168 = 7 gün)")
    backup_compress: bool = Field(default=True, description="Yedekleme sıkıştırması (WITH COMPRESSION)")
    backup_checksum: bool = Field(default=True, description="Sağlama toplamı (WITH CHECKSUM)")
    backup_verify: bool = Field(default=True, description="Yedek sonrası doğrulama (RESTORE VERIFYONLY)")
    backup_diff_enabled: bool = Field(default=True, description="Fark (Differential) yedeği dahil edilsin mi?")
    backup_log_enabled: bool = Field(default=True, description="İşlem günlüğü (Transaction Log) yedeği dahil edilsin mi?")
    backup_log_frequency_minutes: int = Field(default=15, description="Transaction log yedekleme sıklığı (dakika)")
    index_optimize_enabled: bool = Field(default=True, description="İndeks ve istatistik bakım işi üretilsin mi?")
    frag_reorganize_threshold: int = Field(default=10, description="REORGANIZE parçalanma eşiği (%)")
    frag_rebuild_threshold: int = Field(default=30, description="REBUILD parçalanma eşiği (%)")
    online_rebuild: bool = Field(default=True, description="ONLINE = ON parametresi kullanılsın mı?")
    resumable_rebuild: bool = Field(default=False, description="RESUMABLE = ON (SQL Server 2017+)")
    maxdop: int = Field(default=2, description="Bakım işlemi için maksimum paralellik derecesi (MAXDOP)")
    update_statistics: Literal["ALL", "INDEX", "COLUMNS", "NONE"] = Field(default="ALL", description="Güncellenecek istatistik kapsamı")
    only_modified_statistics: bool = Field(default=True, description="Yalnızca verisi değişen istatistikleri güncelle (@OnlyModifiedStatistics = 'Y')")
    integrity_check_enabled: bool = Field(default=True, description="Veritabanı bütünlük kontrolü (DBCC CHECKDB) dahil edilsin mi?")
    integrity_mode: Literal["FULL", "PHYSICAL_ONLY"] = Field(default="FULL", description="Bütünlük kontrolü derinliği")
    operator_name: Optional[str] = Field(default="DBA_Operator", description="SQL Server Agent bildirim operatörü")
    operator_email: Optional[str] = Field(default=None, description="Operatör e-posta adresi")


class MaintenanceJobScriptResponse(BaseModel):
    solution_type: str
    target_database: str
    ola_installer_url: str
    ola_deployment_script: str
    agent_jobs_script: str
    verification_script: str
    cleanup_script: str
    jobs_created_count: int
    job_names: List[str]
    execution_guidance: List[str]
