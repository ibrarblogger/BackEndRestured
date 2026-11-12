import { Response } from 'express';
import { ErrorDetail } from '../errors';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages?: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data: T | null;
  meta?: PaginationMeta;
  errors?: ErrorDetail[];
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  message = 'Success',
  statusCode = 200,
  meta?: PaginationMeta
): Response {
  const payload: ApiResponse<T> = {
    success: true,
    message,
    data,
  };
  if (meta) {
    payload.meta = {
      ...meta,
      totalPages: Math.ceil(meta.total / Math.max(meta.limit, 1)),
    };
  }
  return res.status(statusCode).json(payload);
}

export function sendError(
  res: Response,
  message: string,
  statusCode = 500,
  errors?: ErrorDetail[]
): Response {
  const payload: ApiResponse<null> = {
    success: false,
    message,
    data: null,
    errors: errors || [],
  };
  return res.status(statusCode).json(payload);
}

