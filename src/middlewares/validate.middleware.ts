import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError, ZodEffects } from 'zod';
import { ValidationError } from '../errors';

export interface ValidateSchema {
  body?: AnyZodObject | ZodEffects<any>;
  query?: AnyZodObject | ZodEffects<any>;
  params?: AnyZodObject | ZodEffects<any>;
}

export function validate(schema: ValidateSchema) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (schema.params) {
        req.params = await schema.params.parseAsync(req.params);
      }
      if (schema.query) {
        req.query = await schema.query.parseAsync(req.query);
      }
      if (schema.body) {
        req.body = await schema.body.parseAsync(req.body);
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
          code: issue.code,
        }));
        next(new ValidationError('Request validation failed', details));
        return;
      }
      next(error);
    }
  };
}

