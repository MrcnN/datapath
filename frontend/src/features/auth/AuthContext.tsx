import React, { createContext, useContext, useState, useEffect } from 'react';
import type { UserProfile, UserLoginRequest, UserRegisterRequest, ProfileUpdateRequest } from '../../lib/types';
import {
  loginUser,
  registerUser,
  oauthLoginUser,
  getCurrentUser,
  updateUserProfile,
  changeUserPassword,
  logoutUser,
  elevateToAdmin as apiElevateToAdmin,
} from '../../lib/api';

const fallbackAdmin: UserProfile = {
  id: 'usr_admin_01',
  email: 'erdim@datapath.internal',
  username: 'erdim',
  full_name: 'Erdim',
  role: 'SENIOR_DBA',
  title: 'Veritabanı Yöneticisi & Mimar',
  department: 'Veritabanı & Altyapı Yönetimi',
  phone: '+90 532 000 00 01',
  bio: 'SQL Server yüksek erişilebilirlik, felaket kurtarma ve performans optimizasyonu lideri.',
  avatar_url: undefined,
  google_connected: true,
  github_connected: true,
  created_at: '2026-01-15T09:00:00Z',
  last_login_at: new Date().toISOString(),
};

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  loading: boolean;
  login: (req: UserLoginRequest) => Promise<void>;
  register: (req: UserRegisterRequest) => Promise<void>;
  loginOAuth: (
    provider: 'google' | 'github',
    customPayload?: { email?: string; full_name?: string; avatar_url?: string }
  ) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (req: ProfileUpdateRequest) => Promise<UserProfile>;
  changePassword: (curr: string, next: string) => Promise<void>;
  elevateToAdmin: () => Promise<UserProfile>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem('datapath_user');
      return saved ? JSON.parse(saved) : fallbackAdmin;
    } catch {
      return fallbackAdmin;
    }
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('datapath_token') || 'token_admin_demo');
  const [loading, setLoading] = useState<boolean>(false);

  // Sync current user on load
  useEffect(() => {
    async function initUser() {
      try {
        const u = await getCurrentUser();
        setUser(u);
        localStorage.setItem('datapath_user', JSON.stringify(u));
      } catch (err) {
        console.warn('Could not sync current user profile:', err);
      }
    }
    initUser();
  }, [token]);

  const login = async (req: UserLoginRequest) => {
    const res = await loginUser(req);
    setUser(res.user);
    setToken(res.token);
    localStorage.setItem('datapath_token', res.token);
    localStorage.setItem('datapath_user', JSON.stringify(res.user));
  };

  const register = async (req: UserRegisterRequest) => {
    const res = await registerUser(req);
    setUser(res.user);
    setToken(res.token);
    localStorage.setItem('datapath_token', res.token);
    localStorage.setItem('datapath_user', JSON.stringify(res.user));
  };

  const loginOAuth = async (
    provider: 'google' | 'github',
    customPayload?: { email?: string; full_name?: string; avatar_url?: string }
  ) => {
    const email = customPayload?.email?.trim() || (provider === 'google' ? 'erdim.dba@gmail.com' : 'erdim-architect@github.com');
    const name = customPayload?.full_name?.trim() || (provider === 'google' ? 'Erdim (Google Workspace Senior DBA)' : 'Erdim (GitHub Dev)');
    const avatar = customPayload?.avatar_url || (provider === 'google'
      ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80'
      : 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80');

    const res = await oauthLoginUser({
      provider,
      email,
      full_name: name,
      avatar_url: avatar,
      oauth_id: `${provider}_${Date.now()}`,
    });

    setUser(res.user);
    setToken(res.token);
    localStorage.setItem('datapath_token', res.token);
    localStorage.setItem('datapath_user', JSON.stringify(res.user));
  };

  const logout = async () => {
    try {
      await logoutUser();
    } catch {
      // ignore
    }
    setUser(fallbackAdmin);
    setToken('token_admin_demo');
    localStorage.setItem('datapath_user', JSON.stringify(fallbackAdmin));
  };

  const updateProfile = async (req: ProfileUpdateRequest): Promise<UserProfile> => {
    const updated = await updateUserProfile(req);
    setUser(updated);
    localStorage.setItem('datapath_user', JSON.stringify(updated));
    return updated;
  };

  const changePassword = async (curr: string, next: string) => {
    await changeUserPassword({ current_password: curr, new_password: next });
  };

  const elevateToAdmin = async (): Promise<UserProfile> => {
    const updated = await apiElevateToAdmin();
    setUser(updated);
    localStorage.setItem('datapath_user', JSON.stringify(updated));
    return updated;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        register,
        loginOAuth,
        logout,
        updateProfile,
        changePassword,
        elevateToAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
