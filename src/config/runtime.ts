/**
 * Runtime environment detection and guards.
 * Detects whether the process is executing within a serverless lambda (Vercel, AWS)
 * or a persistent long-running container (Railway, Docker, Localhost).
 */

export const isServerless: boolean = Boolean(
  process.env.VERCEL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.LAMBDA_TASK_ROOT ||
    process.env.VERCEL_ENV
);

if (isServerless) {
  console.log(
    '⚡ [Runtime] Running in Serverless mode (Vercel): Real-time WebSockets, background BullMQ workers, and Redis connections are disabled. Use Railway or Docker for full real-time capabilities.'
  );
}

