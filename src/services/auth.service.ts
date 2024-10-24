import { StorageService } from '@/services/storage.service';
import type {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  CheckEmailResponse,
} from '@/types/auth';

// 임시 사용자 데이터
const MOCK_USERS = [
  {
    email: 'test@test.com',
    password: 'password123',
    username: 'Test User',
  },
];

export class AuthService {
  private static instance: AuthService;

  private constructor() {}

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  private generateMockToken(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async login(data: LoginRequest): Promise<LoginResponse> {
    await this.delay(500);

    const user = MOCK_USERS.find((u) => u.email === data.email);

    if (!user || user.password !== data.password) {
      throw new Error('Invalid email or password');
    }

    const tokens = {
      accessToken: this.generateMockToken(),
      refreshToken: this.generateMockToken(),
    };

    StorageService.setAccessToken(tokens.accessToken);
    StorageService.setRefreshToken(tokens.refreshToken);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: '1',
        email: user.email,
        username: user.username,
      },
    };
  }

  async register(data: RegisterRequest): Promise<RegisterResponse> {
    await this.delay(500);

    // 이메일 중복 체크
    if (MOCK_USERS.some((u) => u.email === data.email)) {
      throw new Error('Email already exists');
    }

    // 새 사용자 추가
    MOCK_USERS.push({
      email: data.email,
      password: data.password,
      username: data.username,
    });

    // 회원가입 성공 응답
    return {
      accessToken: '', // 토큰은 로그인 시에만 제공
      refreshToken: '', // 토큰은 로그인 시에만 제공
      user: {
        id: MOCK_USERS.length.toString(),
        email: data.email,
        username: data.username,
      },
    };
  }

  async checkEmail(email: string): Promise<boolean> {
    await this.delay(500);
    return MOCK_USERS.some((u) => u.email === email);
  }

  logout(): void {
    StorageService.clearTokens();
  }

  isAuthenticated(): boolean {
    return !!StorageService.getAccessToken();
  }

  async refreshToken(refreshToken: string): Promise<{ accessToken: string }> {
    await this.delay(500);

    if (!refreshToken) {
      throw new Error('Invalid refresh token');
    }

    const newAccessToken = this.generateMockToken();
    StorageService.setAccessToken(newAccessToken);

    return { accessToken: newAccessToken };
  }
}

export const authService = AuthService.getInstance();
