
import 'dotenv/config';
import { Queue, Worker, Job } from 'bullmq';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { outbox, herobmCore } from './schema';
import { eq, isNull, sql } from 'drizzle-orm';
import express from 'express';
import { collectDefaultMetrics, Registry, Counter } from 'prom-client';
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

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PASSWORD = requireEnv('REDIS_PASSWORD');

const PORT = process.env.WORKER_PORT || process.env.PORT || 9092;

// Setup DB
const pgClient = postgres(`postgres://${PG_USER}:${PG_PASS}@${PG_HOST}:${PG_PORT}/${PG_DB}`);
const db = drizzle(pgClient, { schema: { herobmCore, outbox } });

// Setup Mock Client (Removed)

// Setup BullMQ
const connection = {
  host: REDIS_HOST,
  port: 6379,
  password: REDIS_PASSWORD,
};

const syncQueue = new Queue('external-sync', { connection });

// Setup Metrics
const register = new Registry();
collectDefaultMetrics({ register });

const eventsProcessedCounter = new Counter({
  name: 'outbox_events_processed_total',
  help: 'Total outbox events successfully enqueued for external sync',
  labelNames: ['event_type'],
  registers: [register],
});

const eventsFailedCounter = new Counter({
  name: 'outbox_events_failed_total',
  help: 'Total outbox event processing failures',
  labelNames: ['event_type'],
  registers: [register],
});

const journalEntriesCounter = new Counter({
  name: 'journal_entries_created_total',
  help: 'Total Journal Entries successfully created',
  labelNames: ['event_type'],
  registers: [register],
});

// Re-export counters for relay.service to use
export { eventsProcessedCounter, eventsFailedCounter, journalEntriesCounter };

import { pollOutbox, processEvent } from './relay.service';
import { pollEmailOutbox } from './email-relay';
import { purgeOldEmails } from './purge-emails.service';
import { checkSupplierCompliance } from './check-supplier-compliance.service';

// Start Worker
const worker = new Worker('external-sync', (job) => processEvent(job, db), { connection, concurrency: 5 });

worker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err: err.message }, 'BullMQ job failed');
  if (job?.data?.type) {
    eventsFailedCounter.inc({ event_type: job.data.type });
  }
});

// Setup System Maintenance Queue and Worker
const maintenanceQueue = new Queue('system-maintenance', { connection });
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

const maintenanceWorker = new Worker(
  'system-maintenance',
  async (job) => {
    if (job.name === 'purge-emails') {
      return purgeOldEmails(job, db);
    } else if (job.name === 'check-supplier-compliance') {
      return checkSupplierCompliance(job, db);
    }
  },
  { connection, concurrency: 1 }
);

maintenanceWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err: err.message }, 'BullMQ maintenance job failed');
});

// Start Express for Metrics
const app = express();
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
const server = app.listen(PORT, () => {
  logger.info({ port: PORT }, 'Worker running, metrics exposed');
});

// Start Polling
const pollInterval = setInterval(() => {
  pollOutbox(db, syncQueue);
  pollEmailOutbox(db);
}, 5000);

// Initial poll
pollOutbox(db, syncQueue);
pollEmailOutbox(db);

// Graceful Shutdown
let isShuttingDown = false;
async function shutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info({ signal }, 'Shutting down worker gracefully...');
  
  clearInterval(pollInterval);
  
  try {
    server.close();
    await worker.close();
    await maintenanceWorker.close();
    await syncQueue.close();
    await maintenanceQueue.close();
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
