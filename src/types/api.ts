export interface ApiResponse<T> {
  data: T;
  status: number;
  message: string;
}

export interface ErrorResponse {
  status: number;
  message: string;
  errors?: Record<string, string[]>;
}
