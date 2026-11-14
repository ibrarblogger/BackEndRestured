import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { isServerless } from '../config/runtime';
import { verifyAccessToken, AccessTokenPayload } from '../utils/jwt';

export const SOCKET_EVENTS = {
  ORDER_CREATED: 'order:created',
  ORDER_UPDATED: 'order:updated',
  ORDER_STATUS_CHANGED: 'order:statusChanged',
  KITCHEN_TICKET_NEW: 'kitchen:ticketNew',
  KITCHEN_TICKET_READY: 'kitchen:ticketReady',
  TABLE_STATUS_CHANGED: 'table:statusChanged',
  STOCK_LOW: 'stock:low',
  RESERVATION_NEW: 'reservation:new',
  NOTIFICATION_NEW: 'notification:new',
} as const;

export type SocketEventName = (typeof SOCKET_EVENTS)[keyof typeof SOCKET_EVENTS];

export interface AuthenticatedSocket extends Socket {
  user?: AccessTokenPayload;
}

let ioInstance: Server | null = null;

export function initSocketServer(httpServer: HttpServer): Server | null {
  if (isServerless) {
    logger.info('⚡ [Socket.io] Realtime WebSocket server disabled in Serverless (Vercel) mode.');
    return null;
  }

  const allowedOrigins = new Set([
    ...env.CORS_ORIGINS,
    env.API_BASE_URL,
    `http://localhost:${env.PORT}`,
    `http://127.0.0.1:${env.PORT}`,
  ]);

  const io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.has(origin) || allowedOrigins.has('*')) {
          callback(null, true);
        } else {
          callback(new Error(`Origin ${origin} not allowed by Socket.io CORS`));
        }
      },
      credentials: true,
    },
  });

  // JWT Authentication Middleware for Socket.io
  io.use((socket: AuthenticatedSocket, next) => {
    try {
      const authHeader = socket.handshake.headers.authorization;
      const token =
        socket.handshake.auth?.token ||
        (authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : undefined) ||
        (socket.handshake.query?.token as string | undefined);

      if (!token) {
        return next(new Error('Authentication error: missing JWT token'));
      }

      const payload = verifyAccessToken(token);
      socket.user = payload;
      next();
    } catch {
      next(new Error('Authentication error: invalid or expired JWT token'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    const user = socket.user;
    if (!user) {
      socket.disconnect(true);
      return;
    }

    socket.join(`user:${user.sub}`);
    socket.join(`role:${user.roleSlug}`);

    if (user.branchId) {
      socket.join(`branch:${user.branchId}`);
      socket.join(`branch:${user.branchId}:role:${user.roleSlug}`);
    }

    socket.on('join:branch', (branchId: string) => {
      if (user.roleSlug === 'super-admin' || user.branchId === branchId) {
        socket.join(`branch:${branchId}`);
      }
    });

    socket.on('join:station', (station: string) => {
      if (user.branchId) {
        socket.join(`branch:${user.branchId}:station:${station}`);
      }
    });

    logger.debug(
      { socketId: socket.id, userId: user.sub, branchId: user.branchId, role: user.roleSlug },
      'Socket client connected'
    );

    socket.on('disconnect', () => {
      logger.debug({ socketId: socket.id, userId: user.sub }, 'Socket client disconnected');
    });
  });

  ioInstance = io;
  return io;
}

export function getIO(): Server | null {
  return ioInstance;
}

/**
 * Emits a real-time Socket.io event to a specific branch room.
 * Safely no-ops when running in serverless mode or when Socket.io is not initialized.
 */
export function emitSocketEvent<T>(
  event: SocketEventName,
  payload: T,
  options?: {
    branchId?: string | null;
    roleSlug?: string;
    userId?: string;
    station?: string;
  }
): void {
  if (isServerless || !ioInstance) return;

  if (options?.userId) {
    ioInstance.to(`user:${options.userId}`).emit(event, payload);
    return;
  }

  if (options?.branchId && options?.station) {
    ioInstance.to(`branch:${options.branchId}:station:${options.station}`).emit(event, payload);
  }

  if (options?.branchId && options?.roleSlug) {
    ioInstance.to(`branch:${options.branchId}:role:${options.roleSlug}`).emit(event, payload);
    return;
  }

  if (options?.branchId) {
    ioInstance.to(`branch:${options.branchId}`).emit(event, payload);
    return;
  }

  if (options?.roleSlug) {
    ioInstance.to(`role:${options.roleSlug}`).emit(event, payload);
    return;
  }

  ioInstance.emit(event, payload);
}
