import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/stores/authStore';
import type { ApiResponse } from '@/types/auth';

export class ApiClient {
  private readonly client: AxiosInstance;
  private readonly publicClient: AxiosInstance;

  constructor(baseURL: string) {
    this.client = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
      },
      withCredentials: true,
    });

    this.publicClient = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
      },
      withCredentials: true,
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    this.client.interceptors.request.use((config) => {
      const accessToken = useAuthStore.getState().accessToken;
      if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`;
      }
      return config;
    });

    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            const refreshToken = useAuthStore.getState().refreshToken;
            if (!refreshToken) {
              throw new Error('No refresh token available');
            }

            const response = await this.publicClient.post<ApiResponse<{ accessToken: string }>>(
              '/auth/refresh',
              {
                refreshToken,
              },
            );

            const newAccessToken = response.data.data.accessToken;
            useAuthStore.getState().setTokens(newAccessToken, refreshToken);

            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
            return this.client(originalRequest);
          } catch (refreshError) {
            useAuthStore.getState().clearAuth();
            window.location.href = '/login';
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      },
    );
  }

  async publicGet<T>(path: string, config?: AxiosRequestConfig) {
    try {
      const response = await this.publicClient.get<T>(path, config);
      return response.data;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  async publicPost<T>(path: string, data?: unknown, config?: AxiosRequestConfig) {
    try {
      const response = await this.publicClient.post<T>(path, data, config);
      return response.data;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  async get<T>(path: string, config?: AxiosRequestConfig) {
    try {
      const response = await this.client.get<T>(path, config);
      return response.data;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  async post<T>(path: string, data?: unknown, config?: AxiosRequestConfig) {
    try {
      const response = await this.client.post<T>(path, data, config);
      return response.data;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  private handleError(error: any) {
    if (axios.isAxiosError(error)) {
      const message = error.response?.data?.message || '서버 오류가 발생했습니다.';
      console.error('API Error:', message);
    }
  }
}

export const apiClient = new ApiClient('http://localhost:8080');
