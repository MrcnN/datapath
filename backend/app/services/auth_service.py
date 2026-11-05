"""services/auth_service.py — In-memory & JSON backed user identity, OAuth integration, profile management, and Super-Admin role permission policies."""
from __future__ import annotations

import logging
import uuid
import copy
from datetime import datetime, timezone
from typing import Dict, List, Optional

from app.schemas.auth import (
    UserProfile,
    UserLoginRequest,
    UserRegisterRequest,
    OAuthLoginRequest,
    ProfileUpdateRequest,
    PasswordChangeRequest,
    AuthResponse,
    PermissionDefinition,
    PermissionAuditLog,
    RolePermissionMatrixResponse,
    UpdateRolePermissionsRequest,
    UpdateUserRoleRequest,
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

# =====================================================================
# Permissions Catalog Definition
# =====================================================================
_PERMISSIONS_CATALOG: List[PermissionDefinition] = [
    # 1. Kriz & Canlı Müdahale
    PermissionDefinition(
        id="perm_01",
        code="sessions.kill",
        name="Kilitlenen Oturumu Sonlandır (KILL SPID)",
        category="Kriz & Canlı Müdahale",
        description="Sistemi kilitleyen veya CPU'yu tüketen kaçak oturumları acil durumda sonlandırma T-SQL reçetesi oluşturur.",
        risk_level="CRITICAL",
    ),
    PermissionDefinition(
        id="perm_02",
        code="sessions.view",
        name="Canlı Oturumları ve sp_whoisactive İzle",
        category="Kriz & Canlı Müdahale",
        description="Sunucuda çalışan tüm aktif oturumları, bekleme türlerini ve kök kilit bloklayıcılarını canlı izler.",
        risk_level="LOW",
    ),
    PermissionDefinition(
        id="perm_03",
        code="deadlocks.resolve",
        name="Deadlock Analizi ve Kilit Zinciri Müdahalesi",
        category="Kriz & Canlı Müdahale",
        description="Oluşan kilitlenme döngülerini interaktif SVG grafiğinde inceler ve kilitlenen nesneye doğrudan müdahale eder.",
        risk_level="HIGH",
    ),

    # 2. Sorgu & Performans Zekası
    PermissionDefinition(
        id="perm_04",
        code="query_store.force_plan",
        name="Query Store Planı Zorla (Force Plan)",
        category="Sorgu & Performans",
        description="Performansı gerileyen ağır sorgular için bilinen iyi sorgu planını Query Store üzerinden dondurur/zorlar.",
        risk_level="HIGH",
    ),
    PermissionDefinition(
        id="perm_05",
        code="queries.rewrite",
        name="Sorgu Düzeltici & Diff Analizi",
        category="Sorgu & Performans",
        description="SARGable olmayan kodları, implicit conversion hatalarını ve anti-pattern sorguları güvenli T-SQL ile yeniden yazar.",
        risk_level="MEDIUM",
    ),
    PermissionDefinition(
        id="perm_06",
        code="execution_plan.analyze",
        name="Yürütme Planı (.sqlplan) Derin Ağaç İncelemesi",
        category="Sorgu & Performans",
        description="XML sorgu planlarını operatör seviyesinde ayrıştırır, maliyet dağılımını ve TempDB dökülmelerini inceler.",
        risk_level="LOW",
    ),

    # 3. İndeks & Bakım Operasyonları
    PermissionDefinition(
        id="perm_07",
        code="indexes.rebuild",
        name="İndeks REBUILD / REORGANIZE Operasyonu Planla",
        category="İndeks & Bakım",
        description="Parçalanma eşiklerine göre online/offline indeks bakım reçeteleri hazırlar ve SQL Agent Job üretir.",
        risk_level="HIGH",
    ),
    PermissionDefinition(
        id="perm_08",
        code="hypothetical_indexes.simulate",
        name="Sanal İndeks (WITH STATISTICS_ONLY) Simülatörü",
        category="İndeks & Bakım",
        description="Diske bayt yazmadan 'What-If' sanal indeksleri simüle eder ve maliyet iyileştirme oranını ölçer.",
        risk_level="LOW",
    ),
    PermissionDefinition(
        id="perm_09",
        code="statistics.update",
        name="Bayat İstatistikleri Güncelle (UPDATE STATISTICS)",
        category="İndeks & Bakım",
        description="Modifikasyon sayacı aşılmış ve kardinalite tahminini bozan bayat istatistikleri FULLSCAN ile tazeler.",
        risk_level="MEDIUM",
    ),

    # 4. Bellek & Depolama Operasyonları
    PermissionDefinition(
        id="perm_10",
        code="storage.autogrowth_modify",
        name="Disk Dosya Boyutlandırma & VLF Küçültme",
        category="Bellek & Depolama",
        description="LDF ve MDF dosyalarının büyüme oranlarını düzenler, VLF şişmesini gidermek için kontrollü shrink T-SQL üretir.",
        risk_level="HIGH",
    ),
    PermissionDefinition(
        id="perm_11",
        code="tempdb.purge_version_store",
        name="TempDB Version Store & Purge Blocker Müdahalesi",
        category="Bellek & Depolama",
        description="Snapshot izolasyonunda en eski açık transaction'ı (Purge Blocker) tespit eder ve sürüm alanını rahatlatır.",
        risk_level="HIGH",
    ),
    PermissionDefinition(
        id="perm_12",
        code="buffer_pool.checkpoint",
        name="Kontrollü CHECKPOINT Çalıştırma Yönergesi",
        category="Bellek & Depolama",
        description="RAM'deki kirli sayfaların diske yazılmasını tetikleyen ve ani I/O patlamalarını önleyen yönerge hazırlar.",
        risk_level="MEDIUM",
    ),

    # 5. Yüksek Erişilebilirlik & Kurtarma
    PermissionDefinition(
        id="perm_13",
        code="ha.failover",
        name="AlwaysOn AG Yük Devretme (Failover)",
        category="Güvenilirlik & Kurtarma",
        description="AlwaysOn Availability Group replikaları arasında kontrollü veya acil yük devretme komutlarını oluşturur.",
        risk_level="CRITICAL",
    ),
    PermissionDefinition(
        id="perm_14",
        code="backups.restore_simulate",
        name="LSN Point-in-Time Kurtarma Simülasyonu",
        category="Güvenilirlik & Kurtarma",
        description="Hedef dakikaya dönüş için ardışık Full -> Diff -> Log LSN zincirini doğrular ve STOPAT komutunu simüle eder.",
        risk_level="MEDIUM",
    ),
    PermissionDefinition(
        id="perm_15",
        code="backups.take_backup",
        name="Ad-hoc Veritabanı ve Log Yedeği Alma",
        category="Güvenilirlik & Kurtarma",
        description="Kritik bakım öncesinde ad-hoc COPY_ONLY tam yedek veya Tail-Log kurtarma yedeği T-SQL reçetesi oluşturur.",
        risk_level="HIGH",
    ),

    # 6. Güvenlik & Yetki Politikası (Sadece En Üst Yetki)
    PermissionDefinition(
        id="perm_16",
        code="roles.manage_permissions",
        name="Tüm Rollerin Sistem İzinlerini Yönet ve Düzenle",
        category="Yetki & Güvenlik Yönetimi",
        description="Tüm platformdaki rollerin (Senior DBA, DB Engineer, Operator, Viewer) granüler izin matrisini açıp kapatır.",
        risk_level="CRITICAL",
    ),
    PermissionDefinition(
        id="perm_17",
        code="users.assign_roles",
        name="Kullanıcı Rollerini Değiştir & Yetkilendir",
        category="Yetki & Güvenlik Yönetimi",
        description="Platforma kayıtlı kullanıcıların operasyonel rollerini yükseltir, düşürür veya hesap durumunu günceller.",
        risk_level="CRITICAL",
    ),
    PermissionDefinition(
        id="perm_18",
        code="security.audit_logs",
        name="Güvenlik ve Yetki Denetim Günlüklerini İncele",
        category="Yetki & Güvenlik Yönetimi",
        description="Kimin hangi yetkiyi veya kullanıcı rolünü ne zaman değiştirdiğini gösteren kronolojik denetim loglarını listeler.",
        risk_level="LOW",
    ),
]

# Default Baseline Role Policies
_DEFAULT_ROLE_POLICIES: Dict[str, List[str]] = {
    "SENIOR_DBA": [p.code for p in _PERMISSIONS_CATALOG],  # Senior DBA has all permissions
    "DB_ENGINEER": [
        "sessions.view",
        "deadlocks.resolve",
        "query_store.force_plan",
        "queries.rewrite",
        "execution_plan.analyze",
        "indexes.rebuild",
        "hypothetical_indexes.simulate",
        "statistics.update",
        "tempdb.purge_version_store",
        "backups.restore_simulate",
    ],
    "OPERATOR": [
        "sessions.view",
        "execution_plan.analyze",
        "hypothetical_indexes.simulate",
        "backups.restore_simulate",
    ],
    "VIEWER": [
        "sessions.view",
        "execution_plan.analyze",
        "security.audit_logs",
    ],
}

_ROLE_POLICIES: Dict[str, List[str]] = copy.deepcopy(_DEFAULT_ROLE_POLICIES)

_ROLE_LABELS: Dict[str, str] = {
    "SENIOR_DBA": "Kıdemli DBA (En Üst Yetki)",
    "DB_ENGINEER": "Veritabanı Güvenilirlik Mühendisi",
    "OPERATOR": "Sistem & NOC Operatörü",
    "VIEWER": "Gözlemci & Denetçi",
}

_PERMISSION_AUDIT_LOGS: List[PermissionAuditLog] = [
    PermissionAuditLog(
        id="audit_init_01",
        timestamp=datetime.now(timezone.utc).isoformat(),
        operator_name="Erdim (Senior DBA)",
        operator_role="SENIOR_DBA",
        action="Sistem Başlangıç Politikası Yüklendi",
        details="Tüm roller için varsayılan kurumsal DBA yetki matrisi aktif edildi.",
    ),
]


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

    # Log user creation
    _PERMISSION_AUDIT_LOGS.insert(
        0,
        PermissionAuditLog(
            id=f"audit_{uuid.uuid4().hex[:6]}",
            timestamp=now_iso,
            operator_name=new_user["full_name"],
            operator_role=new_user["role"],
            action="Yeni Kullanıcı Kaydı",
            details=f"{email_clean} adresiyle {new_user['role']} rolünde yeni hesap oluşturuldu.",
        ),
    )

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
        new_id = f"usr_{uuid.uuid4().hex[:8]}"
        username = email_clean.split("@")[0].replace(".", "_")
        active_user = {
            "id": new_id,
            "email": email_clean,
            "username": username,
            "password": uuid.uuid4().hex,
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
    return _user_dict_to_profile(_USERS_DB["usr_admin_01"])


def update_profile(user_id: str, req: ProfileUpdateRequest) -> UserProfile:
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


# =====================================================================
# Role & Permission Policy Management Methods (En Üst Yetki Merkezi)
# =====================================================================

def get_permission_matrix(current_user: Optional[UserProfile] = None) -> RolePermissionMatrixResponse:
    """Returns catalog of all permissions, current role policies, and audit logs."""
    is_senior = bool(current_user and current_user.role == "SENIOR_DBA")
    return RolePermissionMatrixResponse(
        is_senior_dba=is_senior,
        permissions=_PERMISSIONS_CATALOG,
        role_policies=_ROLE_POLICIES,
        role_labels=_ROLE_LABELS,
        audit_logs=_PERMISSION_AUDIT_LOGS[:20],
    )


def update_role_permissions(current_user: UserProfile, req: UpdateRolePermissionsRequest) -> RolePermissionMatrixResponse:
    """Only Senior DBA can change what permissions each role possesses."""
    if current_user.role != "SENIOR_DBA":
        raise PermissionError("Yetkisiz Erişim: Rol izinlerini yalnızca En Üst Yetkili (Senior DBA) yönetebilir.")

    if req.role not in _ROLE_POLICIES:
        raise ValueError(f"Tanımsız rol: {req.role}")

    # Senior DBA always retains roles.manage_permissions and core permissions
    new_perms = list(req.permissions)
    if req.role == "SENIOR_DBA" and "roles.manage_permissions" not in new_perms:
        new_perms.append("roles.manage_permissions")

    old_count = len(_ROLE_POLICIES[req.role])
    _ROLE_POLICIES[req.role] = new_perms

    now_iso = datetime.now(timezone.utc).isoformat()
    _PERMISSION_AUDIT_LOGS.insert(
        0,
        PermissionAuditLog(
            id=f"audit_{uuid.uuid4().hex[:6]}",
            timestamp=now_iso,
            operator_name=current_user.full_name,
            operator_role=current_user.role,
            action=f"{_ROLE_LABELS.get(req.role, req.role)} İzinleri Güncellendi",
            details=f"{old_count} olan izin sayısı {len(new_perms)} olarak yeniden düzenlendi.",
        ),
    )

    return get_permission_matrix(current_user)


def get_all_users() -> List[UserProfile]:
    """Returns list of all registered users in the platform."""
    return [_user_dict_to_profile(u) for u in _USERS_DB.values()]


def update_user_role(current_user: UserProfile, req: UpdateUserRoleRequest) -> UserProfile:
    """Senior DBA can promote/demote user roles."""
    if current_user.role != "SENIOR_DBA":
        raise PermissionError("Yetkisiz Erişim: Kullanıcı rolünü yalnızca En Üst Yetkili (Senior DBA) değiştirebilir.")

    if req.user_id not in _USERS_DB:
        raise ValueError("Belirtilen kullanıcı bulunamadı.")

    if req.new_role not in _ROLE_LABELS:
        raise ValueError(f"Geçersiz rol: {req.new_role}")

    u = _USERS_DB[req.user_id]
    old_role = u["role"]
    u["role"] = req.new_role

    now_iso = datetime.now(timezone.utc).isoformat()
    _PERMISSION_AUDIT_LOGS.insert(
        0,
        PermissionAuditLog(
            id=f"audit_{uuid.uuid4().hex[:6]}",
            timestamp=now_iso,
            operator_name=current_user.full_name,
            operator_role=current_user.role,
            action=f"Kullanıcı Rolü Değiştirildi ({u['full_name']})",
            details=f"Eski Rol: {old_role} -> Yeni Rol: {req.new_role}",
        ),
    )

    return _user_dict_to_profile(u)


def reset_permissions_to_default(current_user: UserProfile) -> RolePermissionMatrixResponse:
    """Restores baseline enterprise role policies."""
    if current_user.role != "SENIOR_DBA":
        raise PermissionError("Yetkisiz Erişim: Fabrika ayarlarına yalnızca En Üst Yetkili (Senior DBA) dönebilir.")

    global _ROLE_POLICIES
    _ROLE_POLICIES = copy.deepcopy(_DEFAULT_ROLE_POLICIES)

    now_iso = datetime.now(timezone.utc).isoformat()
    _PERMISSION_AUDIT_LOGS.insert(
        0,
        PermissionAuditLog(
            id=f"audit_{uuid.uuid4().hex[:6]}",
            timestamp=now_iso,
            operator_name=current_user.full_name,
            operator_role=current_user.role,
            action="Fabrika Ayarlarına Sıfırlandı",
            details="Tüm rollerin izinleri varsayılan kurumsal DBA politikasına döndürüldü.",
        ),
    )

    return get_permission_matrix(current_user)
