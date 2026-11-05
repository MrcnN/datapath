"""api/auth.py — Authentication, OAuth, Profile, and Super-Admin Role Permission Management endpoints."""
from __future__ import annotations

import logging
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Header

from app.schemas.auth import (
    UserProfile,
    UserLoginRequest,
    UserRegisterRequest,
    OAuthLoginRequest,
    ProfileUpdateRequest,
    PasswordChangeRequest,
    AuthResponse,
    RolePermissionMatrixResponse,
    UpdateRolePermissionsRequest,
    UpdateUserRoleRequest,
)
from app.services import auth_service

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Authentication & Role Management"])


def _extract_token(authorization: Optional[str]) -> Optional[str]:
    if authorization and authorization.startswith("Bearer "):
        return authorization[7:]
    return None


@router.post("/auth/login", response_model=AuthResponse)
def login(req: UserLoginRequest):
    """Authenticate user with email/username and password."""
    try:
        return auth_service.login(req)
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))
    except Exception as e:
        logger.error("Login error: %s", e)
        raise HTTPException(status_code=500, detail="Giriş işlemi sırasında beklenmeyen bir hata oluştu.")


@router.post("/auth/register", response_model=AuthResponse)
def register(req: UserRegisterRequest):
    """Register a new user account with role and department."""
    try:
        return auth_service.register(req)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("Registration error: %s", e)
        raise HTTPException(status_code=500, detail="Kayıt işlemi sırasında bir hata oluştu.")


@router.post("/auth/oauth", response_model=AuthResponse)
def oauth_login(req: OAuthLoginRequest):
    """Sign in or register with Google (Gmail) or GitHub OAuth."""
    try:
        return auth_service.oauth_login(req)
    except Exception as e:
        logger.error("OAuth error: %s", e)
        raise HTTPException(status_code=500, detail="OAuth yetkilendirmesi sırasında bir hata oluştu.")


@router.get("/auth/me", response_model=UserProfile)
def get_current_user(authorization: Optional[str] = Header(None)):
    """Retrieve profile of the currently active authenticated user."""
    token = _extract_token(authorization)
    return auth_service.get_current_user(token)


@router.put("/auth/profile", response_model=UserProfile)
def update_profile(req: ProfileUpdateRequest, authorization: Optional[str] = Header(None)):
    """Update profile details (name, title, department, bio, phone, avatar)."""
    token = _extract_token(authorization)
    current_user = auth_service.get_current_user(token)
    return auth_service.update_profile(current_user.id, req)


@router.post("/auth/change-password")
def change_password(req: PasswordChangeRequest, authorization: Optional[str] = Header(None)):
    """Change user account password."""
    token = _extract_token(authorization)
    current_user = auth_service.get_current_user(token)
    try:
        auth_service.change_password(current_user.id, req)
        return {"success": True, "message": "Şifreniz başarıyla güncellendi."}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/auth/logout")
def logout():
    """Terminate current user session."""
    return {"success": True, "message": "Oturum başarıyla sonlandırıldı."}


# =====================================================================
# Role & Permission Policy Management Endpoints (En Üst Yetki Merkezi)
# =====================================================================

@router.get("/auth/permissions-matrix", response_model=RolePermissionMatrixResponse)
def get_permissions_matrix(authorization: Optional[str] = Header(None)):
    """Retrieve all permission definitions, role mappings, and audit trail."""
    token = _extract_token(authorization)
    current_user = auth_service.get_current_user(token)
    return auth_service.get_permission_matrix(current_user)


@router.put("/auth/role-permissions", response_model=RolePermissionMatrixResponse)
def update_role_permissions(req: UpdateRolePermissionsRequest, authorization: Optional[str] = Header(None)):
    """Allow Senior DBA (highest authority) to toggle/update permissions for any role."""
    token = _extract_token(authorization)
    current_user = auth_service.get_current_user(token)
    try:
        return auth_service.update_role_permissions(current_user, req)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/auth/users", response_model=List[UserProfile])
def get_all_users(authorization: Optional[str] = Header(None)):
    """Retrieve all platform registered users for role delegation."""
    token = _extract_token(authorization)
    auth_service.get_current_user(token)  # Ensure token validation
    return auth_service.get_all_users()


@router.put("/auth/users/role", response_model=UserProfile)
def update_user_role(req: UpdateUserRoleRequest, authorization: Optional[str] = Header(None)):
    """Allow Senior DBA to promote or demote user operational roles."""
    token = _extract_token(authorization)
    current_user = auth_service.get_current_user(token)
    try:
        return auth_service.update_user_role(current_user, req)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/auth/reset-permissions", response_model=RolePermissionMatrixResponse)
def reset_permissions(authorization: Optional[str] = Header(None)):
    """Reset all role permissions to standard corporate defaults (Senior DBA only)."""
    token = _extract_token(authorization)
    current_user = auth_service.get_current_user(token)
    try:
        return auth_service.reset_permissions_to_default(current_user)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))


@router.post("/auth/elevate-admin", response_model=UserProfile)
def elevate_to_admin(authorization: Optional[str] = Header(None)):
    """Restore SENIOR_DBA (Yönetici) privileges to the primary platform administrator."""
    token = _extract_token(authorization)
    return auth_service.elevate_user_to_admin(token)

