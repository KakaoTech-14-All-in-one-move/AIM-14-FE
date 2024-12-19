import axios, { AxiosInstance } from 'axios';
import { useAuthStore } from '@/stores/authStore';

const API_BASE_URL = import.meta.env.VITE_BE_SERVER_URL;

export class ApiClient {
  public readonly client: AxiosInstance;
  public readonly publicClient: AxiosInstance;

  constructor(baseURL: string) {
    this.client = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.publicClient = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private getTokens() {
    const store = useAuthStore.getState();
    return {
      accessToken: store.accessToken,
      refreshToken: store.refreshToken,
    };
  }

  private setupInterceptors() {
    this.client.interceptors.request.use(
      (config) => {
        const requestId = Math.random().toString(36).substring(7);
        console.log(
          `🚀 API Request Starting [${requestId}]: ${config.method?.toUpperCase()} ${config.url}`,
        );

        const { accessToken } = this.getTokens();
        if (accessToken) {
          config.headers.Authorization = `Bearer ${accessToken}`;
          console.log(
            `🔑 Using access token for request [${requestId}]:`,
            accessToken.substring(0, 10) + '...',
          );
        } else {
          console.warn(`⚠️ No access token available for request [${requestId}]`);
        }

        return config;
      },
      (error) => {
        console.error('Request Interceptor Error:', error);
        return Promise.reject(error);
      },
    );

    this.client.interceptors.response.use(
      (response) => {
        const requestId = Math.random().toString(36).substring(7);
        console.log(
          `✅ API Request Completed [${requestId}]: ${response.config.method?.toUpperCase()} ${response.config.url}`,
        );
        return response;
      },
      async (error) => {
        const originalRequest = error.config;
        const requestId = Math.random().toString(36).substring(7);

        if (error.response?.status === 401 && !originalRequest._retry) {
          console.log(`🔄 Token refresh started [${requestId}] due to 401 error`);
          originalRequest._retry = true;

          try {
            const { refreshToken: currentRefreshToken } = this.getTokens();

            if (!currentRefreshToken) {
              console.error(`❌ Token refresh failed [${requestId}]: No refresh token available`);
              useAuthStore.getState().clearAuth();
              throw new Error('No refresh token available');
            }

            console.log(`📝 Refresh token request [${requestId}]:`, {
              refreshToken: currentRefreshToken.substring(0, 10) + '...',
            });

            const response = await this.publicClient.post<{ accessToken: string }>(
              '/api/v1/auth/refresh',
              {
                refreshToken: currentRefreshToken,
              },
            );

            console.log(`📝 Token refresh response [${requestId}]:`, response.data);

            if (!response.data?.accessToken) {
              console.error(`❌ Invalid token response structure [${requestId}]:`, response.data);
              throw new Error('Invalid token response');
            }

            useAuthStore.getState().setTokens(response.data.accessToken, currentRefreshToken);
            console.log(`✅ Token refresh successful [${requestId}]`);

            originalRequest.headers.Authorization = `Bearer ${response.data.accessToken}`;
            return this.client(originalRequest);
          } catch (refreshError) {
            console.error(`❌ Token refresh failed [${requestId}]:`, refreshError);
            useAuthStore.getState().clearAuth();
            if (typeof window !== 'undefined') {
              window.location.href = '/login';
            }
            return Promise.reject(refreshError);
          }
        }

        console.error(
          `❌ API Request Failed [${requestId}]: ${originalRequest.method?.toUpperCase()} ${originalRequest.url}`,
          error,
        );
        return Promise.reject(error);
      },
    );

    // 추가: publicClient에 대한 응답 인터셉터
    this.publicClient.interceptors.response.use(
      (response) => {
        const requestId = Math.random().toString(36).substring(7);
        console.log(
          `✅ Public API Request Completed [${requestId}]: ${response.config.method?.toUpperCase()} ${response.config.url}`,
        );
        return response;
      },
      (error) => {
        const requestId = Math.random().toString(36).substring(7);
        console.error(
          `❌ Public API Request Failed [${requestId}]: ${error.config?.method?.toUpperCase()} ${error.config?.url}`,
          error,
        );
        this.handleError(error);
        return Promise.reject(error);
      },
    );
  }

  private handleError(error: any) {
    if (axios.isAxiosError(error)) {
      console.error('API Error Details:', {
        status: error.response?.status,
        message: error.response?.data?.message || '서버 오류가 발생했습니다.',
        url: error.config?.url,
        method: error.config?.method?.toUpperCase(),
        requestData: error.config?.data,
        responseData: error.response?.data,
      });
    }
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
