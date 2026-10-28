"""schemas/backups.py"""
from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class BackupRecord(BaseModel):
    database_name: str
    backup_type: Optional[str] = None  # D, I, L
    backup_type_desc: Optional[str] = None
    backup_start_date: Optional[datetime] = None
    backup_finish_date: Optional[datetime] = None
    duration_seconds: Optional[int] = None
    backup_size_gb: Optional[float] = None
    compressed_size_gb: Optional[float] = None
    compression_ratio: Optional[float] = None
    device_name: Optional[str] = None
    is_password_protected: Optional[bool] = None
    recovery_model: Optional[str] = None


class RecoveryReadiness(BaseModel):
    database_name: str
    recovery_model: Optional[str] = None
    last_full_backup: Optional[datetime] = None
    last_diff_backup: Optional[datetime] = None
    last_log_backup: Optional[datetime] = None
    full_backup_age_hours: Optional[float] = None
    diff_backup_age_hours: Optional[float] = None
    log_backup_age_hours: Optional[float] = None
    recovery_point_objective_risk: str = "unknown"  # low | medium | high | critical
    issues: List[str] = []
    recommendations: List[str] = []
