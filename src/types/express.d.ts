import { AccessTokenPayload } from '../utils/jwt';

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      user?: AccessTokenPayload;
    }
  }
}

export {};
