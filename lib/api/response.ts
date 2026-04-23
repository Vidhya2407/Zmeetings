import { NextResponse } from 'next/server';
import type { ApiResponse, ApiResponseMeta } from '@/types/api';

export function apiSuccess<T>(data: T, meta: ApiResponseMeta = {}, status = 200) {
  const body: ApiResponse<T> = {
    success: true,
    data,
    error: null,
    timestamp: new Date().toISOString(),
    ...meta,
  };

  return NextResponse.json(body, { status });
}

export function apiError(message: string, status = 500, meta: ApiResponseMeta = {}) {
  const body: ApiResponse<null> = {
    success: false,
    data: null,
    error: message,
    timestamp: new Date().toISOString(),
    ...meta,
  };

  return NextResponse.json(body, { status });
}


