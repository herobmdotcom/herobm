import 'dotenv/config';
import { Queue, Worker, Job } from 'bullmq';
import { ERPNextClient, JournalEntry } from '@modbm/erpnext-client';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { outbox, modbmCore } from './schema';
import { eq, isNull, sql } from 'drizzle-orm';
import express from 'express';
import { collectDefaultMetrics, Registry, Counter } from 'prom-client';
import { relayLogger as logger } from './logger';

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
const PG_DB = process.env.POSTGRES_DB || 'custom_app';

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PASSWORD = requireEnv('REDIS_PASSWORD');

const PORT = 9091;

// Setup DB
const pgClient = postgres(`postgres://${PG_USER}:${PG_PASS}@${PG_HOST}:${PG_PORT}/${PG_DB}`);
const db = drizzle(pgClient, { schema: { modbmCore, outbox } });

// Setup ERPNext Client
const erpClient = new ERPNextClient({
  baseUrl: process.env.ERPNEXT_URL || 'http://127.0.0.1:8000',
  apiKey: requireEnv('ERPNEXT_API_KEY'),
  apiSecret: requireEnv('ERPNEXT_API_SECRET'),
});

// Setup BullMQ
const connection = {
  host: REDIS_HOST,
  port: 6379,
  password: REDIS_PASSWORD,
};

const syncQueue = new Queue('erpnext-sync', { connection });

// Setup Metrics
const register = new Registry();
collectDefaultMetrics({ register });

const eventsProcessedCounter = new Counter({
  name: 'outbox_events_processed_total',
  help: 'Total outbox events successfully enqueued for ERPNext sync',
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
  help: 'Total ERPNext Journal Entries successfully created',
  labelNames: ['event_type'],
  registers: [register],
});

// Re-export counters for relay.service to use
export { eventsProcessedCounter, eventsFailedCounter, journalEntriesCounter };

import { pollOutbox, processEvent } from './relay.service';

// Start Worker
const worker = new Worker('erpnext-sync', (job) => processEvent(job, erpClient, db), { connection, concurrency: 5 });

worker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err: err.message }, 'BullMQ job failed');
  if (job?.data?.type) {
    eventsFailedCounter.inc({ event_type: job.data.type });
  }
});

// Start Express for Metrics
const app = express();
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
app.listen(PORT, () => {
  logger.info({ port: PORT }, 'Worker running, metrics exposed');
});

// Start Polling
setInterval(() => pollOutbox(db, syncQueue), 5000);
pollOutbox(db, syncQueue); // Initial poll
