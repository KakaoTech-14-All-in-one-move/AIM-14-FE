import type { ApiResponse } from '@/types/api';
import { StorageService } from '@/services/storage.service';

class ApiClient {
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // 비인증 요청 메서드
  async publicGet<T>(url: string): Promise<ApiResponse<T>> {
    await this.delay(500);
    // 임시 응답 데이터
    return {
      data: {} as T,
      status: 200,
      message: 'Success',
    };
  }

  async publicPost<T>(url: string, data?: unknown): Promise<ApiResponse<T>> {
    await this.delay(500);
    // 임시 응답 데이터
    return {
      data: {} as T,
      status: 200,
      message: 'Success',
    };
  }

  // 인증 요청 메서드
  async get<T>(url: string): Promise<ApiResponse<T>> {
    const token = StorageService.getAccessToken();
    if (!token) {
      throw new Error('No auth token');
    }
    await this.delay(500);
    // 임시 응답 데이터
    return {
      data: {} as T,
      status: 200,
      message: 'Success',
    };
  }

  async post<T>(url: string, data?: unknown): Promise<ApiResponse<T>> {
    const token = StorageService.getAccessToken();
    if (!token) {
      throw new Error('No auth token');
    }
    await this.delay(500);
    // 임시 응답 데이터
    return {
      data: {} as T,
      status: 200,
      message: 'Success',
    };
  }

  async put<T>(url: string, data?: unknown): Promise<ApiResponse<T>> {
    const token = StorageService.getAccessToken();
    if (!token) {
      throw new Error('No auth token');
    }
    await this.delay(500);
    // 임시 응답 데이터
    return {
      data: {} as T,
      status: 200,
      message: 'Success',
    };
  }

  async delete<T>(url: string): Promise<ApiResponse<T>> {
    const token = StorageService.getAccessToken();
    if (!token) {
      throw new Error('No auth token');
    }
    await this.delay(500);
    // 임시 응답 데이터
    return {
      data: {} as T,
      status: 200,
      message: 'Success',
    };
  }
}

export const apiClient = new ApiClient();

/*

import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios';
import type { ApiResponse, ErrorResponse } from '@/types/api';
import { StorageService } from '@/services/storage.service';

class ApiClient {
  private baseClient: AxiosInstance;
  private authClient: AxiosInstance;
  private isRefreshing: boolean = false;
  private refreshSubscribers: ((token: string) => void)[] = [];

  constructor() {
    this.baseClient = axios.create({
      baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3000/api',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.authClient = axios.create({
      baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3000/api',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupAuthInterceptors();
  }

  private setupAuthInterceptors() {
    this.authClient.interceptors.request.use(
      (config) => {
        const token = StorageService.getAccessToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error),
    );

    this.authClient.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        if (error.response?.status !== 401 || originalRequest._retry) {
          return Promise.reject(error);
        }

        if (!this.isRefreshing) {
          this.isRefreshing = true;
          originalRequest._retry = true;

          try {
            const refreshToken = StorageService.getRefreshToken();
            const response = await this.baseClient.post('/auth/refresh', { refreshToken });
            const { accessToken } = response.data;

            StorageService.setAccessToken(accessToken);
            this.onRefreshSuccess(accessToken);

            originalRequest.headers.Authorization = `Bearer ${accessToken}`;
            return this.authClient(originalRequest);
          } catch (refreshError) {
            this.onRefreshFailure(refreshError);
            return Promise.reject(refreshError);
          } finally {
            this.isRefreshing = false;
          }
        }

        return new Promise((resolve) => {
          this.refreshSubscribers.push((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(this.authClient(originalRequest));
          });
        });
      },
    );
  }

  private onRefreshSuccess(token: string) {
    this.refreshSubscribers.forEach((callback) => callback(token));
    this.refreshSubscribers = [];
  }

  private onRefreshFailure(error: AxiosError) {
    this.refreshSubscribers = [];
    StorageService.clearTokens();
    window.dispatchEvent(new CustomEvent('auth:loginRequired'));
  }

  // 비인증 요청 메서드
  async publicGet<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.baseClient.get<ApiResponse<T>>(url, config);
    return response.data;
  }

  async publicPost<T>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<ApiResponse<T>> {
    const response = await this.baseClient.post<ApiResponse<T>>(url, data, config);
    return response.data;
  }

  // 인증 요청 메서드
  async get<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.authClient.get<ApiResponse<T>>(url, config);
    return response.data;
  }

  async post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.authClient.post<ApiResponse<T>>(url, data, config);
    return response.data;
  }

  async put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.authClient.put<ApiResponse<T>>(url, data, config);
    return response.data;
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.authClient.delete<ApiResponse<T>>(url, config);
    return response.data;
  }
}

export const apiClient = new ApiClient();
*/
