"""schemas/auth.py — Authentication, Authorization, OAuth, and User Profile models."""
from __future__ import annotations

from typing import Optional, List
from pydantic import BaseModel, EmailStr


class UserProfile(BaseModel):
    id: str
    email: str
    username: str
    full_name: str
    role: str  # "SENIOR_DBA", "DB_ENGINEER", "OPERATOR", "VIEWER"
    title: str
    department: str
    phone: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    google_connected: bool = False
    github_connected: bool = False
    created_at: str
    last_login_at: str


class UserLoginRequest(BaseModel):
    email_or_username: str
    password: str


class UserRegisterRequest(BaseModel):
    full_name: str
    email: str
    password: str
    role: Optional[str] = "DB_ENGINEER"
    title: Optional[str] = "Veritabanı Uzmanı"
    department: Optional[str] = "Veri Altyapı Grubu"


class OAuthLoginRequest(BaseModel):
    provider: str  # "google" | "github"
    email: str
    full_name: str
    avatar_url: Optional[str] = None
    oauth_id: Optional[str] = None


class ProfileUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    title: Optional[str] = None
    department: Optional[str] = None
    phone: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    role: Optional[str] = None


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str


class AuthResponse(BaseModel):
    success: bool
    token: str
    user: UserProfile
    message: str
