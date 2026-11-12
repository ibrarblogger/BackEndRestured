import http from 'http';
import { app } from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { connectDatabaseWithRetry, disconnectDatabase } from './config/prisma';
import { jobQueue } from './jobs/queue';
import { initSocketServer } from './sockets';

const server = http.createServer(app);
initSocketServer(server);

async function bootstrap() {
  await connectDatabaseWithRetry(3, 1500);

  server.listen(env.PORT, () => {
    logger.info(
      `🚀 Restaurant Management System API + Socket.io running on ${env.API_BASE_URL} [${env.NODE_ENV}]`
    );
    logger.info(`📚 Swagger OpenAPI Docs available at ${env.API_BASE_URL}/api/docs`);
  });
}

async function gracefulShutdown(signal: string) {
  logger.info(`${signal} received. Starting graceful shutdown...`);
  server.close(async () => {
    await jobQueue.shutdown();
    await disconnectDatabase();
    logger.info('HTTP & Socket.io server closed cleanly.');
    process.exit(0);
  });

  setTimeout(() => {
    logger.error('Forced shutdown after timeout.');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

bootstrap().catch((err) => {
  logger.error({ err }, 'Fatal error during server bootstrap');
  process.exit(1);
});
