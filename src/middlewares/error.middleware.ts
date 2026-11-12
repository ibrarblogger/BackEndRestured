import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../errors';
import { logger } from '../config/logger';
import { sendError } from '../utils/response';

export function notFoundHandler(req: Request, res: Response): void {
  sendError(res, `Route ${req.method} ${req.originalUrl} not found`, 404, [
    { code: 'ROUTE_NOT_FOUND', message: `Cannot ${req.method} ${req.originalUrl}` },
  ]);
}

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error({ err, requestId: req.requestId, path: req.originalUrl }, err.message);
    }
    sendError(res, err.message, err.statusCode, err.errors);
    return;
  }

  if (err instanceof ZodError) {
    const details = err.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
    }));
    sendError(res, 'Validation failed', 400, details);
    return;
  }

  // Prisma known request errors
  if (err?.code === 'P2002') {
    const target = Array.isArray(err.meta?.target) ? err.meta.target.join(', ') : 'field';
    sendError(res, `A record with this ${target} already exists`, 409, [
      { field: target, code: 'UNIQUE_CONSTRAINT', message: `Duplicate value for ${target}` },
    ]);
    return;
  }

  if (err?.code === 'P2025') {
    sendError(res, 'Requested record was not found', 404, [
      { code: 'NOT_FOUND', message: err.meta?.cause || 'Record not found' },
    ]);
    return;
  }

  // Prisma connection / Supabase cold-start or unreachable errors -> 503
  if (
    err?.code === 'P1001' ||
    err?.code === 'P1002' ||
    err?.code === 'P1008' ||
    err?.code === 'P1017' ||
    (typeof err?.message === 'string' &&
      (err.message.includes("Can't reach database server") ||
        err.message.includes('ECONNREFUSED')))
  ) {
    logger.error({ err, requestId: req.requestId }, 'Database unavailable (503)');
    sendError(
      res,
      'Database is temporarily unreachable or waking up from sleep. Please retry shortly.',
      503,
      [{ code: 'DATABASE_UNAVAILABLE', message: 'Supabase PostgreSQL connection unavailable' }]
    );
    return;
  }

  logger.error({ err, requestId: req.requestId, path: req.originalUrl }, 'Unhandled error');
  sendError(res, 'Internal server error', 500, [
    {
      code: 'INTERNAL_SERVER_ERROR',
      message: process.env.NODE_ENV === 'production' ? 'Unexpected error occurred' : err?.message || 'Error',
    },
  ]);
}

