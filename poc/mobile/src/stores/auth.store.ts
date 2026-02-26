import { create } from 'zustand';
import { getToken, setToken, clearAll, setUserData, getUserData } from '@/lib/secure-store';
import { decodeToken, isTokenExpired } from '@/lib/token';
import { authApi } from '@/api/auth.api';
import type { User, LoginRequest, TokenInfo } from '@/types';

interface AuthState {
  token: string | null;
  user: User | null;
  tokenInfo: TokenInfo | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isHydrated: boolean;

  hydrate: () => Promise<void>;
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  setAuth: (token: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  tokenInfo: null,
  isAuthenticated: false,
  isLoading: false,
  isHydrated: false,

  hydrate: async () => {
    try {
      const token = await getToken();
      if (token && !isTokenExpired(token)) {
        const tokenInfo = decodeToken(token);
        const userData = await getUserData() as User | null;
        set({
          token,
          tokenInfo,
          user: userData || (tokenInfo ? {
            id: tokenInfo.sub,
            name: tokenInfo.name,
            email: tokenInfo.email,
            role: tokenInfo.role,
            isActive: true,
          } : null),
          isAuthenticated: true,
          isHydrated: true,
        });
      } else {
        if (token) await clearAll();
        set({ isHydrated: true });
      }
    } catch {
      set({ isHydrated: true });
    }
  },

  login: async (credentials: LoginRequest) => {
    set({ isLoading: true });
    try {
      const response = await authApi.login(credentials);
      await get().setAuth(response.jwtToken);
    } finally {
      set({ isLoading: false });
    }
  },

  logout: async () => {
    await clearAll();
    set({
      token: null,
      user: null,
      tokenInfo: null,
      isAuthenticated: false,
    });
  },

  setAuth: async (token: string) => {
    const tokenInfo = decodeToken(token);
    const user: User = {
      id: tokenInfo?.sub || '',
      name: tokenInfo?.name || '',
      email: tokenInfo?.email || '',
      role: tokenInfo?.role || 'user',
      isActive: true,
    };

    await setToken(token);
    await setUserData(user);

    set({
      token,
      tokenInfo,
      user,
      isAuthenticated: true,
    });
  },
}));
