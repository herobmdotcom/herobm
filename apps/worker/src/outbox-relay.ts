
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

const envFileName = process.env.ENV_FILE || '.env';
const candidateEnvPaths = [
  path.resolve(process.cwd(), envFileName),
  path.resolve(__dirname, '../../..', envFileName),
  path.resolve(__dirname, '../..', envFileName),
  path.resolve(__dirname, '..', envFileName),
];

for (const p of candidateEnvPaths) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p });
    break;
  }
}
import { Queue, Worker, Job } from 'bullmq';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { outbox, herobmCore } from '@herobm/db-schema';
import { eq, isNull, sql } from 'drizzle-orm';
import express from 'express';
import { getMeter } from '@herobm/shared';
import { relayLogger as logger } from './logger';

process.on('uncaughtException', (err) => { logger.error({ err }, 'UNCAUGHT EXCEPTION'); process.exit(1); });
process.on('unhandledRejection', (err) => { logger.error({ err }, 'UNHANDLED REJECTION'); process.exit(1); });


// Helpers
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `FATAL: Required environment variable ${name} is not set. Check your .env file.`,
    );
  }
  return value;
}

// Config
const PG_USER = requireEnv('POSTGRES_USER');
const PG_PASS = requireEnv('POSTGRES_PASSWORD');
const PG_HOST = process.env.POSTGRES_HOST || 'localhost';
const PG_PORT = process.env.POSTGRES_PORT || '5432';
const PG_DB = process.env.POSTGRES_DB || 'herobm';

const REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
const REDIS_PORT = Number(process.env.REDIS_PORT) || 6379;
const REDIS_PASSWORD = requireEnv('REDIS_PASSWORD');

const PORT = process.env.WORKER_PORT || process.env.PORT || 9092;

// Setup DB
const pgClient = postgres(`postgres://${PG_USER}:${PG_PASS}@${PG_HOST}:${PG_PORT}/${PG_DB}`);
const db = drizzle(pgClient, { schema: { herobmCore, outbox } });

// Setup Mock Client (Removed)

import { getBullMQConnectionOptions } from './redis.config';

// Setup BullMQ
const connection = getBullMQConnectionOptions(REDIS_HOST, REDIS_PORT, REDIS_PASSWORD);

const syncQueue = new Queue('external-sync', { connection });
syncQueue.on('error', (err) => {
  logger.warn({ err: err.message }, 'BullMQ syncQueue Redis connection error');
});

// Setup Metrics via OpenTelemetry Sockets
const meter = getMeter('herobm-worker');

const eventsProcessedCounter = meter.createCounter('outbox_events_processed_total', {
  description: 'Total outbox events successfully enqueued for external sync',
});

const eventsFailedCounter = meter.createCounter('outbox_events_failed_total', {
  description: 'Total outbox event processing failures',
});

const journalEntriesCounter = meter.createCounter('journal_entries_created_total', {
  description: 'Total Journal Entries successfully created',
});

// Re-export counters for relay.service to use
export { eventsProcessedCounter, eventsFailedCounter, journalEntriesCounter };

import { pollOutbox, processEvent } from './relay.service';
import { pollEmailOutbox } from './email-relay';
import { purgeOldEmails } from './purge-emails.service';
import { checkSupplierCompliance } from './check-supplier-compliance.service';
import { verifyLedgerIntegrity } from './verify-ledger-integrity.service';

// Start Worker
const worker = new Worker('external-sync', (job) => processEvent(job, db), { connection, concurrency: 5 });

worker.on('error', (err) => {
  logger.warn({ err: err.message }, 'BullMQ sync worker Redis connection error');
});

worker.on('failed', (job, err) => {
  const attemptsMade = job?.attemptsMade || 1;
  const maxAttempts = job?.opts.attempts || 1;

  if (attemptsMade >= maxAttempts) {
    logger.error(
      { jobId: job?.id, attemptsMade, maxAttempts, err: err.message },
      'ALERT: BullMQ job permanently failed (max retries reached). Event moved to dead-letter state in outbox.'
    );
  } else {
    logger.warn(
      { jobId: job?.id, attemptsMade, maxAttempts, err: err.message },
      'BullMQ job failed, scheduled for retry'
    );
  }

  if (job?.data?.type) {
    eventsFailedCounter.add(1, { event_type: job.data.type });
  }
});

// Setup System Maintenance Queue and Worker
const maintenanceQueue = new Queue('system-maintenance', { connection });
maintenanceQueue.on('error', (err) => {
  logger.warn({ err: err.message }, 'BullMQ maintenanceQueue Redis connection error');
});

maintenanceQueue.add(
  'purge-emails',
  {},
  {
    repeat: {
      pattern: '0 0 * * *', // Every day at midnight
    },
  }
).catch(err => {
  logger.error({ err }, 'Failed to schedule purge-emails job');
});

maintenanceQueue.add(
  'check-supplier-compliance',
  {},
  {
    repeat: {
      pattern: '0 1 * * *', // Every day at 1 AM
    },
  }
).catch(err => {
  logger.error({ err }, 'Failed to schedule check-supplier-compliance job');
});

maintenanceQueue.add(
  'verify-ledger-integrity',
  {},
  {
    repeat: {
      pattern: '0 2 * * *', // Every day at 2 AM
    },
  }
).catch(err => {
  logger.error({ err }, 'Failed to schedule verify-ledger-integrity job');
});

const maintenanceWorker = new Worker(
  'system-maintenance',
  async (job) => {
    if (job.name === 'purge-emails') {
      return purgeOldEmails(job, db);
    } else if (job.name === 'check-supplier-compliance') {
      return checkSupplierCompliance(job, db);
    } else if (job.name === 'verify-ledger-integrity') {
      return verifyLedgerIntegrity(job, db);
    }
  },
  { connection, concurrency: 1 }
);

maintenanceWorker.on('error', (err) => {
  logger.warn({ err: err.message }, 'BullMQ maintenance worker Redis connection error');
});

maintenanceWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err: err.message }, 'BullMQ maintenance job failed');
});

// Start Express for Health & Metrics
const app = express();
app.get('/health', async (req, res) => {
  try {
    const pgCheck = await pgClient`SELECT 1`;
    const redisClient = await syncQueue.client;
    const redisPing = await redisClient.ping();
    const isHealthy = Boolean(pgCheck && redisPing === 'PONG');
    res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? 'ok' : 'degraded',
      postgres: pgCheck ? 'healthy' : 'unhealthy',
      redis: redisPing === 'PONG' ? 'healthy' : 'unhealthy',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(503).json({
      status: 'degraded',
      error: err.message,
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  }
});
app.get('/metrics', (req, res) => {
  res.json({
    telemetry: 'opentelemetry',
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});
let server: any;
const startServer = (retryCount = 0) => {
  server = app.listen(PORT, () => {
    logger.info({ port: PORT }, 'Worker running, metrics exposed');
  }).on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      if (retryCount < 10) {
        logger.warn({ port: PORT, retryCount }, 'Port in use, retrying in 1s...');
        setTimeout(() => startServer(retryCount + 1), 1000);
      } else {
        logger.error({ port: PORT }, 'Port in use, max retries reached. Exiting.');
        process.exit(1);
      }
    } else {
      logger.error({ err }, 'Express server error');
      process.exit(1);
    }
  });
};
startServer();

// Setup Dedicated Postgres Client for LISTEN/NOTIFY
const subscriberClient = postgres(`postgres://${PG_USER}:${PG_PASS}@${PG_HOST}:${PG_PORT}/${PG_DB}`, {
  max: 1,
  idle_timeout: 0,
});

import { OutboxListener } from './outbox-listener';

const outboxListener = new OutboxListener({
  subscriberClient,
  onSweep: async () => {
    await pollOutbox(db, syncQueue);
    await pollEmailOutbox(db);
  },
  heartbeatIntervalMs: 60000,
});

// Start OutboxListener
outboxListener.start().catch((err) => {
  logger.error({ err }, 'Failed to start OutboxListener');
});

// Graceful Shutdown
let isShuttingDown = false;
async function shutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info({ signal }, 'Shutting down worker gracefully...');

  try {
    await outboxListener.stop();
    server?.close();
    await worker.close();
    await maintenanceWorker.close();
    await syncQueue.close();
    await maintenanceQueue.close();
    await subscriberClient.end();
    await pgClient.end();
    logger.info('Graceful shutdown complete');
    process.exit(0);
  } catch (err) {
    logger.error({ err }, 'Error during shutdown');
    process.exit(1);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGUSR2', () => shutdown('SIGUSR2'));
