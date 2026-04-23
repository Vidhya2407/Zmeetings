export type ApiResponseMeta = {
  [key: string]: unknown;
};

export type ApiResponse<T> = {
  success: boolean;
  data: T;
  error: string | null;
  timestamp: string;
} & ApiResponseMeta;
