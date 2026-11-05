"""tests/test_auth.py — Unit tests for authentication, OAuth (Google & GitHub), and profile management."""
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_login_success():
    res = client.post("/api/auth/login", json={
        "email_or_username": "erdim@datapath.internal",
        "password": "Password123!",
    })
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert "token" in data
    assert data["user"]["email"] == "erdim@datapath.internal"
    assert data["user"]["role"] == "SENIOR_DBA"


def test_login_invalid_password():
    res = client.post("/api/auth/login", json={
        "email_or_username": "erdim@datapath.internal",
        "password": "WrongPassword999!",
    })
    assert res.status_code == 401


def test_register_new_user():
    res = client.post("/api/auth/register", json={
        "full_name": "Ahmet Yılmaz",
        "email": "ahmet.yilmaz@company.com",
        "password": "SecretPassword123!",
        "role": "DB_ENGINEER",
        "title": "Kıdemli Veritabanı Geliştiricisi",
        "department": "Finansal Sistemler",
    })
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["user"]["email"] == "ahmet.yilmaz@company.com"
    assert data["user"]["role"] == "DB_ENGINEER"


def test_oauth_google_login():
    res = client.post("/api/auth/oauth", json={
        "provider": "google",
        "email": "erdim.dev@gmail.com",
        "full_name": "Erdim Google User",
        "avatar_url": "https://lh3.googleusercontent.com/a/demo-avatar",
        "oauth_id": "google_1029384756",
    })
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["user"]["google_connected"] is True
    assert data["user"]["email"] == "erdim.dev@gmail.com"


def test_oauth_github_login():
    res = client.post("/api/auth/oauth", json={
        "provider": "github",
        "email": "erdim-coder@github.com",
        "full_name": "Erdim GitHub Dev",
        "avatar_url": "https://avatars.githubusercontent.com/u/demo-github",
        "oauth_id": "github_99887766",
    })
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["user"]["github_connected"] is True
    assert data["user"]["email"] == "erdim-coder@github.com"


def test_get_current_user_and_update_profile():
    # 1. Get Me
    res = client.get("/api/auth/me")
    assert res.status_code == 200
    user = res.json()
    assert "email" in user
    assert "full_name" in user

    # 2. Update Profile
    update_res = client.put("/api/auth/profile", json={
        "title": "Principal Lead DBA & Performance Architect",
        "phone": "+90 532 999 88 77",
        "bio": "7/24 Kesintisiz SQL Server mimarisi ve felaket kurtarma lideri.",
    })
    assert update_res.status_code == 200
    updated_user = update_res.json()
    assert updated_user["title"] == "Principal Lead DBA & Performance Architect"
    assert updated_user["phone"] == "+90 532 999 88 77"


def test_change_password():
    res = client.post("/api/auth/change-password", json={
        "current_password": "Password123!",
        "new_password": "NewSecurePassword2026!",
    })
    assert res.status_code == 200
    assert res.json()["success"] is True


def test_permissions_matrix_endpoint():
    res = client.get("/api/auth/permissions-matrix")
    assert res.status_code == 200
    data = res.json()
    assert "permissions" in data
    assert "role_policies" in data
    assert len(data["permissions"]) >= 15
    assert "SENIOR_DBA" in data["role_policies"]
    assert "DB_ENGINEER" in data["role_policies"]


def test_update_role_permissions():
    # 1. Update DB_ENGINEER permissions
    res = client.put("/api/auth/role-permissions", json={
        "role": "DB_ENGINEER",
        "permissions": ["sessions.view", "deadlocks.resolve", "queries.rewrite"],
    })
    assert res.status_code == 200
    data = res.json()
    assert "queries.rewrite" in data["role_policies"]["DB_ENGINEER"]
    assert len(data["audit_logs"]) > 0


def test_get_all_users_and_update_role():
    # 1. Get users
    res = client.get("/api/auth/users")
    assert res.status_code == 200
    users = res.json()
    assert len(users) >= 2

    # 2. Update user role
    target_user = users[1]
    update_res = client.put("/api/auth/users/role", json={
        "user_id": target_user["id"],
        "new_role": "OPERATOR",
    })
    assert update_res.status_code == 200
    assert update_res.json()["role"] == "OPERATOR"


def test_reset_permissions():
    res = client.post("/api/auth/reset-permissions")
    assert res.status_code == 200
    data = res.json()
    assert "ha.failover" in data["role_policies"]["SENIOR_DBA"]
