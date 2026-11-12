import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { Application } from 'express';
import helmet from 'helmet';
import hpp from 'hpp';
import path from 'path';
import pinoHttp from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env';
import { logger } from './config/logger';
import { openApiSpec } from './config/swagger';
import { registerBackgroundJobHandlers } from './jobs/handlers';
import { jobsRoutes } from './jobs/routes';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware';
import { globalRateLimiter } from './middlewares/rateLimit.middleware';
import { requestIdMiddleware } from './middlewares/requestId.middleware';
import { sanitizeMiddleware } from './middlewares/sanitize.middleware';
import { auditRoutes } from './modules/audit/routes';
import { authRoutes } from './modules/auth/routes';
import { branchesRoutes } from './modules/branches/routes';
import { customersRoutes } from './modules/customers/routes';
import { dashboardRoutes } from './modules/dashboard/routes';
import { deliveryRoutes } from './modules/delivery/routes';
import { expensesRoutes } from './modules/expenses/routes';
import { inventoryRoutes } from './modules/inventory/routes';
import { kitchenRoutes } from './modules/kitchen/routes';
import { menuRoutes } from './modules/menu/routes';
import { notificationsRoutes } from './modules/notifications/routes';
import { ordersRoutes } from './modules/orders/routes';
import { paymentsRoutes } from './modules/payments/routes';
import { reportsRoutes } from './modules/reports/routes';
import { staffRoutes } from './modules/staff/routes';
import { suppliersRoutes } from './modules/suppliers/routes';
import { tablesRoutes } from './modules/tables/routes';
import { usersRoutes } from './modules/users/routes';
import { sendSuccess } from './utils/response';

export function createApp(): Application {
  registerBackgroundJobHandlers();
  const app = express();

  // 1. Request ID & Structured Logging
  app.use(requestIdMiddleware);
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => (req as any).requestId,
      autoLogging: env.NODE_ENV !== 'test',
    })
  );

  // 2. Security Headers & CORS Whitelist
  app.use(helmet());
  const allowedOrigins = new Set([
    ...env.CORS_ORIGINS,
    env.API_BASE_URL,
    `http://localhost:${env.PORT}`,
    `http://127.0.0.1:${env.PORT}`,
  ]);
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.has(origin) || allowedOrigins.has('*')) {
          callback(null, true);
        } else {
          callback(new Error(`Origin ${origin} not allowed by CORS`));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'Idempotency-Key'],
    })
  );

  // 3. Rate Limiting, Body Parsing, HPP & Sanitization
  app.use(globalRateLimiter);
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));
  app.use(cookieParser());
  app.use(hpp());
  app.use(compression() as any);
  app.use(sanitizeMiddleware);

  // 4. Static Local Uploads Fallback & OpenAPI Docs
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));

  // 5. Root & Health Check Endpoints
  app.get('/', (_req, res) => {
    sendSuccess(
      res,
      {
        name: 'Restaurant Management System (ERP/POS) API',
        version: '1.0.0',
        status: 'running',
        environment: env.NODE_ENV,
        docsUrl: `${env.API_BASE_URL}/api/docs`,
        healthUrl: `${env.API_BASE_URL}/api/v1/health`,
        apiBaseUrl: `${env.API_BASE_URL}/api/v1`,
      },
      'Welcome to the Restaurant Management System API'
    );
  });

  app.get('/api/v1', (_req, res) => {
    sendSuccess(
      res,
      {
        version: 'v1',
        docsUrl: `${env.API_BASE_URL}/api/docs`,
        endpoints: {
          health: '/api/v1/health',
          auth: '/api/v1/auth',
          users: '/api/v1/users',
          roles: '/api/v1/users/roles',
          permissions: '/api/v1/users/permissions',
          branches: '/api/v1/branches',
          audit: '/api/v1/audit',
          menu: '/api/v1/menu',
          tables: '/api/v1/tables',
          reservations: '/api/v1/tables/reservations',
          waitlist: '/api/v1/tables/waitlist',
          orders: '/api/v1/orders',
          kitchen: '/api/v1/kitchen',
          payments: '/api/v1/payments',
          inventory: '/api/v1/inventory',
          suppliers: '/api/v1/suppliers',
          customers: '/api/v1/customers',
          staff: '/api/v1/staff',
          expenses: '/api/v1/expenses',
          delivery: '/api/v1/delivery',
          reports: '/api/v1/reports',
          dashboard: '/api/v1/dashboard',
          notifications: '/api/v1/notifications',
          jobs: '/api/v1/jobs',
        },
      },
      'Restaurant Management System API v1'
    );
  });

  app.get('/api/v1/health', (_req, res) => {
    sendSuccess(
      res,
      {
        status: 'ok',
        environment: env.NODE_ENV,
        timestamp: new Date().toISOString(),
        uptimeSeconds: Math.floor(process.uptime()),
      },
      'Restaurant Management System API is healthy'
    );
  });

  // 6. API v1 Module Routes (Phases 1, 2, 3, 4 & 5)
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/users', usersRoutes);
  app.use('/api/v1/branches', branchesRoutes);
  app.use('/api/v1/audit', auditRoutes);
  app.use('/api/v1/menu', menuRoutes);
  app.use('/api/v1/tables', tablesRoutes);
  app.use('/api/v1/orders', ordersRoutes);
  app.use('/api/v1/kitchen', kitchenRoutes);
  app.use('/api/v1/payments', paymentsRoutes);
  app.use('/api/v1/inventory', inventoryRoutes);
  app.use('/api/v1/suppliers', suppliersRoutes);
  app.use('/api/v1/customers', customersRoutes);
  app.use('/api/v1/staff', staffRoutes);
  app.use('/api/v1/expenses', expensesRoutes);
  app.use('/api/v1/delivery', deliveryRoutes);
  app.use('/api/v1/reports', reportsRoutes);
  app.use('/api/v1/dashboard', dashboardRoutes);
  app.use('/api/v1/notifications', notificationsRoutes);
  app.use('/api/v1/jobs', jobsRoutes);

  // 7. 404 & Central Error Handler
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export const app = createApp();
