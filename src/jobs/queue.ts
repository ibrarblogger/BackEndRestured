import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { randomUUID } from 'crypto';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { isRedisConfigured } from '../config/redis';

export type BackgroundJobType =
  | 'CRM_CAMPAIGN'
  | 'LOW_STOCK_SCAN'
  | 'DAILY_CLOSING_DIGEST';

export interface BackgroundJobRecord {
  id: string;
  type: BackgroundJobType;
  mode: 'bullmq' | 'memory';
  status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  payload: Record<string, unknown>;
  result?: unknown;
  error?: string;
  createdAt: string;
  completedAt?: string;
}

type JobHandler = (payload: Record<string, unknown>) => Promise<unknown>;

class BackgroundJobQueue {
  private handlers = new Map<BackgroundJobType, JobHandler>();
  private recentJobs: BackgroundJobRecord[] = [];
  private bullQueue: Queue | null = null;
  private bullWorker: Worker | null = null;

  registerHandler(type: BackgroundJobType, handler: JobHandler): void {
    this.handlers.set(type, handler);
  }

  private recordJob(job: BackgroundJobRecord) {
    this.recentJobs.unshift(job);
    if (this.recentJobs.length > 100) {
      this.recentJobs.pop();
    }
  }

  private ensureBullInitialized() {
    if (!isRedisConfigured() || this.bullQueue) return;

    const connection = new IORedis(env.REDIS_URL as string, {
      maxRetriesPerRequest: null,
    });

    this.bullQueue = new Queue('rms-background-jobs', { connection });
    this.bullWorker = new Worker(
      'rms-background-jobs',
      async (job) => {
        const jobType = job.name as BackgroundJobType;
        const handler = this.handlers.get(jobType);
        if (!handler) {
          throw new Error(`No handler registered for job type "${jobType}"`);
        }
        return handler((job.data || {}) as Record<string, unknown>);
      },
      { connection }
    );

    this.bullWorker.on('failed', (job, err) => {
      logger.error(
        `BullMQ job failed (${job?.name ?? 'unknown'}): ${err.message}`
      );
    });
  }

  async enqueue(
    type: BackgroundJobType,
    payload: Record<string, unknown>
  ): Promise<BackgroundJobRecord> {
    const id = randomUUID();

    if (isRedisConfigured()) {
      this.ensureBullInitialized();
      if (this.bullQueue) {
        await this.bullQueue.add(type, payload, {
          jobId: id,
          removeOnComplete: 50,
          removeOnFail: 50,
        });
        const record: BackgroundJobRecord = {
          id,
          type,
          mode: 'bullmq',
          status: 'QUEUED',
          payload,
          createdAt: new Date().toISOString(),
        };
        this.recordJob(record);
        return record;
      }
    }

    const record: BackgroundJobRecord = {
      id,
      type,
      mode: 'memory',
      status: 'QUEUED',
      payload,
      createdAt: new Date().toISOString(),
    };
    this.recordJob(record);

    setImmediate(async () => {
      const handler = this.handlers.get(type);
      if (!handler) {
        record.status = 'FAILED';
        record.error = `No handler registered for job type "${type}"`;
        record.completedAt = new Date().toISOString();
        return;
      }

      try {
        record.status = 'PROCESSING';
        record.result = await handler(payload);
        record.status = 'COMPLETED';
        record.completedAt = new Date().toISOString();
      } catch (err: any) {
        record.status = 'FAILED';
        record.error = err?.message || 'Unknown background job error';
        record.completedAt = new Date().toISOString();
        logger.error(`In-memory job ${type} (${id}) failed: ${record.error}`);
      }
    });

    return record;
  }

  async runNow(
    type: BackgroundJobType,
    payload: Record<string, unknown>
  ): Promise<BackgroundJobRecord> {
    const handler = this.handlers.get(type);
    const id = randomUUID();
    const record: BackgroundJobRecord = {
      id,
      type,
      mode: isRedisConfigured() ? 'bullmq' : 'memory',
      status: 'PROCESSING',
      payload,
      createdAt: new Date().toISOString(),
    };
    this.recordJob(record);

    if (!handler) {
      record.status = 'FAILED';
      record.error = `No handler registered for job type "${type}"`;
      record.completedAt = new Date().toISOString();
      return record;
    }

    try {
      record.result = await handler(payload);
      record.status = 'COMPLETED';
      record.completedAt = new Date().toISOString();
    } catch (err: any) {
      record.status = 'FAILED';
      record.error = err?.message || 'Unknown background job error';
      record.completedAt = new Date().toISOString();
    }
    return record;
  }

  getStatusSummary() {
    return {
      backend: isRedisConfigured() ? 'bullmq-redis' : 'in-memory-fallback',
      registeredHandlers: Array.from(this.handlers.keys()),
      recentJobs: this.recentJobs.slice(0, 25),
    };
  }

  async shutdown(): Promise<void> {
    if (this.bullWorker) await this.bullWorker.close();
    if (this.bullQueue) await this.bullQueue.close();
  }
}

export const jobQueue = new BackgroundJobQueue();

