"""api/auth.py — Authentication, OAuth, and Profile Management endpoints."""
from __future__ import annotations

import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Header

from app.schemas.auth import (
    UserProfile,
    UserLoginRequest,
    UserRegisterRequest,
    OAuthLoginRequest,
    ProfileUpdateRequest,
    PasswordChangeRequest,
    AuthResponse,
)
from app.services import auth_service

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Authentication & Profile"])


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
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:]
    return auth_service.get_current_user(token)


@router.put("/auth/profile", response_model=UserProfile)
def update_profile(req: ProfileUpdateRequest, authorization: Optional[str] = Header(None)):
    """Update profile details (name, title, department, bio, phone, avatar)."""
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:]
    current_user = auth_service.get_current_user(token)
    return auth_service.update_profile(current_user.id, req)


@router.post("/auth/change-password")
def change_password(req: PasswordChangeRequest, authorization: Optional[str] = Header(None)):
    """Change user account password."""
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:]
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
