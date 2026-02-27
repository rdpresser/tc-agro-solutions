import { identityApi } from './clients';
import type { LoginRequest, LoginResponse, RegisterRequest, ChangePasswordRequest } from '@/types';

export const authApi = {
  login: async (data: LoginRequest): Promise<LoginResponse> => {
    const response = await identityApi.post('/auth/login', data);
    return response.data;
  },

  register: async (data: RegisterRequest): Promise<void> => {
    await identityApi.post('/auth/register', data);
  },

  checkEmail: async (email: string): Promise<boolean> => {
    const response = await identityApi.get(`/auth/check-email/${email}`);
    return response.data;
  },

  changePassword: async (data: ChangePasswordRequest): Promise<void> => {
    // TODO: replace with real endpoint when available
    await identityApi.post('/auth/change-password', data);
  },
};
