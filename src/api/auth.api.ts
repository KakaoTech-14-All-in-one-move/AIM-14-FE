import { apiClient } from '@/api/apiClient';
import type {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  CheckEmailResponse,
  ApiResponse,
} from '@/types/auth.types';

export const authApi = {
  async login(data: LoginRequest) {
    try {
      const response = await apiClient.publicClient.post<LoginResponse>('/api/v1/auth/login', data);
      return response.data;
    } catch (error) {
      console.error('Login API Error:', error);
      throw error;
    }
  },

  async register(data: RegisterRequest) {
    return await apiClient.publicClient.post<ApiResponse<RegisterResponse>>(
      '/api/v1/auth/signup',
      data,
    );
  },

  async checkEmail(email: string) {
    return await apiClient.publicClient.get<ApiResponse<CheckEmailResponse>>(
      `/api/v1/auth/check?email=${email}`,
    );
  },

  async refreshToken(refreshToken: string) {
    return await apiClient.publicClient.post<ApiResponse<{ accessToken: string }>>(
      '/api/v1/auth/refresh',
      { refreshToken },
    );
  },

  async logout() {
    return await apiClient.client.post('/api/v1/auth/logout');
  },
};
