import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { Application } from 'express';
import helmet from 'helmet';
import hpp from 'hpp';
import os from 'os';
import path from 'path';
import pinoHttp from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import { env, missingEnvVars } from './config/env';
import { logger } from './config/logger';
import { checkDatabaseHealth } from './config/prisma';
import { isServerless } from './config/runtime';
import { openApiSpec } from './config/swagger';
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

// Process-level unhandled exception & rejection monitors (logs stack traces to Vercel Runtime Logs)
process.on('unhandledRejection', (reason: any) => {
  console.error('❌ [Unhandled Rejection at Promise]:', reason?.stack || reason);
});

process.on('uncaughtException', (error: Error) => {
  console.error('❌ [Uncaught Exception thrown]:', error?.stack || error);
});

export function createApp(): Application {
  const app = express();

  // Trust proxy for reverse proxy platforms (Vercel, AWS ALB, Cloudflare)
  app.set('trust proxy', 1);

  // Normalize rewritten URLs from Vercel Serverless routing (/api/index -> /)
  app.use((req, _res, next) => {
    let rawPath: string | undefined;

    // 1. Check query parameter __path forwarded from vercel.json rewrite
    const queryParam = req.query?.__path;
    if (typeof queryParam === 'string' && queryParam.length > 0) {
      let cleaned = decodeURIComponent(queryParam).trim();
      cleaned = cleaned.replace(/^(api\/index(\.js)?\/?)+/i, '');
      cleaned = cleaned.startsWith('/') ? cleaned : `/${cleaned}`;
      rawPath = cleaned;
    }
    // 2. Check Vercel routing headers
    else if (typeof req.headers['x-matched-path'] === 'string') {
      const matched = req.headers['x-matched-path'];
      if (matched.startsWith('/') && !matched.startsWith('/api/index')) {
        rawPath = matched;
      }
    } else if (typeof req.headers['x-forwarded-uri'] === 'string') {
      const forwarded = req.headers['x-forwarded-uri'];
      if (forwarded.startsWith('/') && !forwarded.startsWith('/api/index')) {
        rawPath = forwarded;
      }
    }

    if (rawPath) {
      const queryIdx = req.url.indexOf('?');
      if (queryIdx !== -1) {
        const searchParams = new URLSearchParams(req.url.slice(queryIdx));
        searchParams.delete('__path');
        const remainingQuery = searchParams.toString();
        req.url = rawPath + (remainingQuery ? `?${remainingQuery}` : '');
      } else {
        req.url = rawPath;
      }
      req.originalUrl = req.url;
    } else if (req.url === '/api/index.js' || req.url === '/api/index' || req.url === '/api') {
      req.url = '/';
      req.originalUrl = '/';
    } else if (req.url.startsWith('/api/index.js')) {
      req.url = req.url.replace(/^\/api\/index\.js\/?/, '/') || '/';
      req.originalUrl = req.url;
    } else if (req.url.startsWith('/api/index')) {
      req.url = req.url.replace(/^\/api\/index\/?/, '/') || '/';
      req.originalUrl = req.url;
    }

    next();
  });

  // 0. LIGHTWEIGHT HEALTH CHECK (No auth, no DB, registered right after URL normalization)
  app.get('/health', (_req, res) => {
    res.status(200).json({
      ok: true,
      serverless: isServerless,
      time: new Date().toISOString(),
    });
  });

  // Database connectivity probe (SELECT 1 via Prisma)
  app.get('/health/db', async (_req, res) => {
    try {
      const health = await checkDatabaseHealth();
      res.status(200).json({
        ok: true,
        serverless: isServerless,
        database: 'connected',
        latencyMs: health.latencyMs,
        time: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error('❌ Database health check failed:', err?.message || err);
      res.status(503).json({
        ok: false,
        serverless: isServerless,
        database: 'unreachable',
        message: 'Database is temporarily unreachable or cold-starting. Please retry.',
        time: new Date().toISOString(),
      });
    }
  });

  // Missing required environment variables guard for business API endpoints
  app.use('/api/v1', (_req, res, next) => {
    if (missingEnvVars.length > 0) {
      res.status(500).json({
        success: false,
        message: `Server misconfigured: missing ${missingEnvVars.join(', ')}`,
        data: null,
      });
      return;
    }
    next();
  });

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

  // 4. Static Uploads (uses /tmp when serverless to avoid EROFS) & OpenAPI Docs
  const uploadsStaticDir = isServerless
    ? path.join(os.tmpdir(), 'uploads')
    : path.join(process.cwd(), 'uploads');
  app.use('/uploads', express.static(uploadsStaticDir));

  app.get('/api/docs.json', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(openApiSpec);
  });

  const swaggerOptions = {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Restaurant Management System API Docs',
    customCssUrl: 'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui.min.css',
    customJs: [
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui-bundle.js',
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui-standalone-preset.js',
    ],
  };

  // Serve Swagger UI HTML directly on both with and without trailing slash (no redirect loop)
  app.get(['/api/docs', '/api/docs/'], (_req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(swaggerUi.generateHTML(openApiSpec, swaggerOptions));
  });
  app.use('/api/docs', swaggerUi.serveFiles(openApiSpec, swaggerOptions));

  // 5. Root & Health Check Endpoints
  app.get('/', (_req, res) => {
    sendSuccess(
      res,
      {
        name: 'Restaurant Management System (ERP/POS) API',
        version: '1.0.0',
        status: 'running',
        environment: env.NODE_ENV,
        serverless: isServerless,
        docsUrl: `${env.API_BASE_URL}/api/docs`,
        healthUrl: `${env.API_BASE_URL}/health`,
        dbHealthUrl: `${env.API_BASE_URL}/health/db`,
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
        serverless: isServerless,
        docsUrl: `${env.API_BASE_URL}/api/docs`,
        endpoints: {
          health: '/health',
          dbHealth: '/health/db',
          apiHealth: '/api/v1/health',
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
        serverless: isServerless,
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
export default app;
