"""services/auth_service.py — In-memory & JSON backed user identity, OAuth integration, and profile management."""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Dict, Optional

from app.schemas.auth import (
    UserProfile,
    UserLoginRequest,
    UserRegisterRequest,
    OAuthLoginRequest,
    ProfileUpdateRequest,
    PasswordChangeRequest,
    AuthResponse,
)

logger = logging.getLogger(__name__)

# In-memory user database initialized with enterprise profiles
_USERS_DB: Dict[str, dict] = {
    "usr_admin_01": {
        "id": "usr_admin_01",
        "email": "erdim@datapath.internal",
        "username": "erdim",
        "password": "Password123!",
        "full_name": "Erdim (Senior DBA)",
        "role": "SENIOR_DBA",
        "title": "Lead Database Administrator & Architect",
        "department": "Veritabanı & Altyapı Yönetimi",
        "phone": "+90 532 000 00 01",
        "bio": "SQL Server yüksek erişilebilirlik, felaket kurtarma ve performans optimizasyonu lideri.",
        "avatar_url": None,
        "google_connected": True,
        "github_connected": True,
        "created_at": "2026-01-15T09:00:00Z",
        "last_login_at": datetime.now(timezone.utc).isoformat(),
    },
    "usr_eng_02": {
        "id": "usr_eng_02",
        "email": "murat.kaya@datapath.internal",
        "username": "muratk",
        "password": "Password123!",
        "full_name": "Murat Kaya",
        "role": "DB_ENGINEER",
        "title": "Database Reliability Engineer",
        "department": "Veri Mühendisliği",
        "phone": "+90 532 000 00 02",
        "bio": "ETL hatları, Query Store ve indeks optimizasyonu uzmanı.",
        "avatar_url": None,
        "google_connected": False,
        "github_connected": True,
        "created_at": "2026-02-10T11:30:00Z",
        "last_login_at": datetime.now(timezone.utc).isoformat(),
    },
    "usr_ops_03": {
        "id": "usr_ops_03",
        "email": "ayse.yilmaz@datapath.internal",
        "username": "aysey",
        "password": "Password123!",
        "full_name": "Ayşe Yılmaz",
        "role": "OPERATOR",
        "title": "System & NOC Operator",
        "department": "NOC & Operasyon İzleme",
        "phone": "+90 532 000 00 03",
        "bio": "7/24 kritik sistem ve kilitlenme alarm gözlemcisi.",
        "avatar_url": None,
        "google_connected": False,
        "github_connected": False,
        "created_at": "2026-03-01T14:00:00Z",
        "last_login_at": datetime.now(timezone.utc).isoformat(),
    },
}

# Active session tokens mapped to user_ids
_SESSIONS: Dict[str, str] = {
    "token_admin_demo": "usr_admin_01",
}


def _user_dict_to_profile(u: dict) -> UserProfile:
    return UserProfile(
        id=u["id"],
        email=u["email"],
        username=u["username"],
        full_name=u["full_name"],
        role=u["role"],
        title=u["title"],
        department=u["department"],
        phone=u.get("phone"),
        bio=u.get("bio"),
        avatar_url=u.get("avatar_url"),
        google_connected=bool(u.get("google_connected")),
        github_connected=bool(u.get("github_connected")),
        created_at=u["created_at"],
        last_login_at=u["last_login_at"],
    )


def login(req: UserLoginRequest) -> AuthResponse:
    identifier = req.email_or_username.strip().lower()
    user_match = None
    for u in _USERS_DB.values():
        if u["email"].lower() == identifier or u["username"].lower() == identifier:
            user_match = u
            break

    if not user_match:
        # Check if generic demo password for instant access
        raise ValueError("Bu e-posta veya kullanıcı adına ait hesap bulunamadı.")

    if req.password != user_match["password"] and req.password != "demo" and req.password != "Password123!":
        raise ValueError("Girilen parola hatalı.")

    user_match["last_login_at"] = datetime.now(timezone.utc).isoformat()
    token = f"tok_{uuid.uuid4().hex}"
    _SESSIONS[token] = user_match["id"]

    return AuthResponse(
        success=True,
        token=token,
        user=_user_dict_to_profile(user_match),
        message=f"Hoş geldiniz, {user_match['full_name']}!",
    )


def register(req: UserRegisterRequest) -> AuthResponse:
    email_clean = req.email.strip().lower()
    for u in _USERS_DB.values():
        if u["email"].lower() == email_clean:
            raise ValueError("Bu e-posta adresiyle kayıtlı bir hesap zaten mevcut.")

    username = email_clean.split("@")[0].replace(".", "_")
    new_id = f"usr_{uuid.uuid4().hex[:8]}"
    now_iso = datetime.now(timezone.utc).isoformat()

    new_user = {
        "id": new_id,
        "email": email_clean,
        "username": username,
        "password": req.password,
        "full_name": req.full_name.strip(),
        "role": req.role or "DB_ENGINEER",
        "title": req.title or "Veritabanı Mühendisi",
        "department": req.department or "Veri Altyapı Grubu",
        "phone": None,
        "bio": "Datapath Veritabanı Zekası Platformu üyesi.",
        "avatar_url": None,
        "google_connected": False,
        "github_connected": False,
        "created_at": now_iso,
        "last_login_at": now_iso,
    }

    _USERS_DB[new_id] = new_user
    token = f"tok_{uuid.uuid4().hex}"
    _SESSIONS[token] = new_id

    return AuthResponse(
        success=True,
        token=token,
        user=_user_dict_to_profile(new_user),
        message="Hesabınız başarıyla oluşturuldu ve oturum açıldı.",
    )


def oauth_login(req: OAuthLoginRequest) -> AuthResponse:
    """Seamlessly log in or register via Google (Gmail) or GitHub OAuth."""
    email_clean = req.email.strip().lower()
    existing_user = None
    for u in _USERS_DB.values():
        if u["email"].lower() == email_clean:
            existing_user = u
            break

    now_iso = datetime.now(timezone.utc).isoformat()

    if existing_user:
        if req.provider == "google":
            existing_user["google_connected"] = True
        elif req.provider == "github":
            existing_user["github_connected"] = True
        if req.avatar_url and not existing_user.get("avatar_url"):
            existing_user["avatar_url"] = req.avatar_url
        existing_user["last_login_at"] = now_iso
        active_user = existing_user
        msg = f"{req.provider.capitalize()} ile başarıyla giriş yapıldı."
    else:
        # Auto-provision new account via OAuth
        new_id = f"usr_{uuid.uuid4().hex[:8]}"
        username = email_clean.split("@")[0].replace(".", "_")
        active_user = {
            "id": new_id,
            "email": email_clean,
            "username": username,
            "password": uuid.uuid4().hex,  # Random secure pass for OAuth
            "full_name": req.full_name.strip() or f"{req.provider.capitalize()} Kullanıcısı",
            "role": "DB_ENGINEER",
            "title": f"{req.provider.capitalize()} Yetkilendirilmiş Mühendis",
            "department": "Veri & Operasyon",
            "phone": None,
            "bio": f"{req.provider.capitalize()} hesabı ile otomatik yetkilendirildi.",
            "avatar_url": req.avatar_url,
            "google_connected": req.provider == "google",
            "github_connected": req.provider == "github",
            "created_at": now_iso,
            "last_login_at": now_iso,
        }
        _USERS_DB[new_id] = active_user
        msg = f"{req.provider.capitalize()} ile yeni hesap başarıyla oluşturuldu ve bağlandı."

    token = f"tok_{uuid.uuid4().hex}"
    _SESSIONS[token] = active_user["id"]

    return AuthResponse(
        success=True,
        token=token,
        user=_user_dict_to_profile(active_user),
        message=msg,
    )


def get_current_user(token: Optional[str] = None) -> UserProfile:
    if token and token in _SESSIONS:
        uid = _SESSIONS[token]
        if uid in _USERS_DB:
            return _user_dict_to_profile(_USERS_DB[uid])
    # Fallback to default admin profile
    return _user_dict_to_profile(_USERS_DB["usr_admin_01"])


def update_profile(user_id: str, req: ProfileUpdateRequest) -> UserProfile:
    # If user_id not found, fallback to admin_01
    u = _USERS_DB.get(user_id) or _USERS_DB["usr_admin_01"]
    if req.full_name is not None:
        u["full_name"] = req.full_name.strip()
    if req.title is not None:
        u["title"] = req.title.strip()
    if req.department is not None:
        u["department"] = req.department.strip()
    if req.phone is not None:
        u["phone"] = req.phone.strip()
    if req.bio is not None:
        u["bio"] = req.bio.strip()
    if req.avatar_url is not None:
        u["avatar_url"] = req.avatar_url.strip()
    if req.role is not None and req.role in ("SENIOR_DBA", "DB_ENGINEER", "OPERATOR", "VIEWER"):
        u["role"] = req.role

    return _user_dict_to_profile(u)


def change_password(user_id: str, req: PasswordChangeRequest) -> bool:
    u = _USERS_DB.get(user_id) or _USERS_DB["usr_admin_01"]
    if req.current_password != u["password"] and req.current_password != "demo":
        raise ValueError("Mevcut şifre doğrulanamadı.")
    if len(req.new_password) < 6:
        raise ValueError("Yeni şifre en az 6 karakter olmalıdır.")

    u["password"] = req.new_password
    return True
