export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  data: {
    accessToken: string;
    refreshToken: string;
    user: {
      email: string;
      username: string;
      profileImage: string;
    };
  };
  status: number;
  message: string;
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
  accessToken: string;
  refreshToken: string;
  user: {
    email: string;
    username: string;
    profileImage: string;
  };
}

export interface CheckEmailResponse {
  exists: boolean;
}
