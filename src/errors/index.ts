export interface ErrorDetail {
  field?: string;
  message: string;
  code?: string;
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly errors?: ErrorDetail[];
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode = 500,
    code = 'INTERNAL_ERROR',
    errors?: ErrorDetail[],
    isOperational = true
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
    this.statusCode = statusCode;
    this.code = code;
    this.errors = errors;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource', errors?: ErrorDetail[]) {
    super(`${resource} not found`, 404, 'NOT_FOUND', errors);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required or invalid credentials', errors?: ErrorDetail[]) {
    super(message, 401, 'UNAUTHORIZED', errors);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to perform this action', errors?: ErrorDetail[]) {
    super(message, 403, 'FORBIDDEN', errors);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', errors?: ErrorDetail[]) {
    super(message, 400, 'VALIDATION_ERROR', errors);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource conflict or duplicate record', errors?: ErrorDetail[]) {
    super(message, 409, 'CONFLICT', errors);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = 'Too many requests, please try again later') {
    super(message, 429, 'TOO_MANY_REQUESTS');
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message = 'Service or database is temporarily unavailable') {
    super(message, 503, 'SERVICE_UNAVAILABLE');
  }
}

