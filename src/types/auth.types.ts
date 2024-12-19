import { Server } from '@/types/server';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  tokenInfo: {
    accessToken: string;
    refreshToken: string;
  };
  userInfo: {
    email: string;
    username: string;
    user_id: number;
    profile_image: string;
    servers: Server[];
  };
}

export interface ApiResponse<T> {
  data: T;
  status: number;
  message: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  username: string;
}

export interface RegisterResponse {
  tokenInfo: {
    accessToken: string;
    refreshToken: string;
  };
  userInfo: {
    email: string;
    username: string;
    userId: number;
    profile_image: string;
  };
}

export interface CheckEmailResponse {
  exists: boolean;
}
