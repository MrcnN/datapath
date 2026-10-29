"""schemas/permissions.py"""
from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class ServerLogin(BaseModel):
    name: str
    type_desc: Optional[str] = None
    is_disabled: Optional[bool] = None
    is_locked: Optional[bool] = None
    default_database: Optional[str] = None
    create_date: Optional[datetime] = None
    modify_date: Optional[datetime] = None
    has_sysadmin: Optional[bool] = None


class DatabaseUser(BaseModel):
    username: str
    db_name: str
    type_desc: Optional[str] = None
    login_name: Optional[str] = None
    default_schema: Optional[str] = None
    create_date: Optional[datetime] = None
    roles: List[str] = []


class RoleMember(BaseModel):
    member_name: str
    member_type: Optional[str] = None


class ServerRole(BaseModel):
    role_name: str
    role_type: str  # server | database
    db_name: Optional[str] = None
    members: List[RoleMember] = []


class SecurityFinding(BaseModel):
    id: str
    category: str
    severity: str  # 'CRITICAL', 'WARNING', 'INFO'
    database_name: Optional[str] = None
    principal_name: Optional[str] = None
    title: str
    description: str
    risk_impact: str
    remediation_sql: str


class SecurityAuditSummary(BaseModel):
    security_score: int
    critical_count: int
    warning_count: int
    info_count: int
    passed_checks_count: int
    findings: List[SecurityFinding] = []
    hardening_script: str
    is_demo: bool = False

