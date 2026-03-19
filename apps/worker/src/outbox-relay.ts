import 'dotenv/config';
import { Queue, Worker, Job } from 'bullmq';
import { ERPNextClient, JournalEntry } from '@modbm/erpnext-client';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { outbox, modbmCore } from './schema';
import { eq, isNull, sql } from 'drizzle-orm';
import express from 'express';
import { collectDefaultMetrics, Registry } from 'prom-client';

// Config
const PG_USER = process.env.POSTGRES_USER || 'postgres';
const PG_PASS = process.env.POSTGRES_PASSWORD || 'Xk9mQv2Lp7wBnZ4Tj';
const PG_HOST = process.env.POSTGRES_HOST || 'localhost';
const PG_PORT = process.env.POSTGRES_PORT || '5432';
const PG_DB = process.env.POSTGRES_DB || 'custom_app';

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || 'localdev123';

const PORT = 9090;

// Setup DB
const pgClient = postgres(`postgres://${PG_USER}:${PG_PASS}@${PG_HOST}:${PG_PORT}/${PG_DB}`);
const db = drizzle(pgClient, { schema: { modbmCore, outbox } });

// Setup ERPNext Client
const erpClient = new ERPNextClient({
  baseUrl: process.env.ERPNEXT_URL || 'http://127.0.0.1:8000',
  apiKey: process.env.ERPNEXT_API_KEY || '',
  apiSecret: process.env.ERPNEXT_API_SECRET || '',
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

// Polling interval for Outbox
async function pollOutbox() {
  try {
    const pendingEvents = await db
      .select({ id: outbox.outboxId, payload: outbox.payload, type: outbox.eventType })
      .from(outbox)
      .where(isNull(outbox.processedAt))
      .limit(50);

    for (const event of pendingEvents) {
      // Add to BullMQ with ID dedup
      await syncQueue.add(
        'process-event',
        { eventId: event.id, type: event.type, payload: event.payload },
        { jobId: event.id, removeOnComplete: true }
      );
      
      // Mark as processed immediately (if BullMQ fails, the job remains in Redis queue)
      await db
        .update(outbox)
        .set({ processedAt: new Date() })
        .where(eq(outbox.outboxId, event.id));
    }
  } catch (err) {
    console.error('Error polling outbox:', err);
  }
}

// Map events to Journal Entries
async function processEvent(job: Job) {
  const { eventId, type, payload } = job.data;
  console.log(`Processing event ${eventId} of type ${type}`);

  if (type === 'goods_received') {
    const receivedValue = parseFloat(payload.inventoryValueAdded || '0');
    const variance = parseFloat(payload.purchasePriceVariance || '0');
    
    if (receivedValue === 0 && variance === 0) return; // Nothing to post
    
    const accounts = [];
    
    if (receivedValue !== 0) {
       // Debit Inventory (Asset)
       accounts.push({
         account: 'Inventory',
         debit_in_account_currency: receivedValue,
         credit_in_account_currency: 0
       });
       // Credit GRNI (Liability)
       accounts.push({
         account: 'Goods Received Not Invoiced',
         debit_in_account_currency: 0,
         credit_in_account_currency: receivedValue
       });
    }

    if (variance !== 0) {
       // If positive variance: Actual cost > Standard cost. Debit variance, Credit GRNI
       const absVar = Math.abs(variance);
       accounts.push({
         account: 'Cost of Goods Sold', // Standard Cost variance hits COGS
         debit_in_account_currency: variance > 0 ? absVar : 0,
         credit_in_account_currency: variance > 0 ? 0 : absVar
       });
       accounts.push({
         account: 'Goods Received Not Invoiced',
         debit_in_account_currency: variance > 0 ? 0 : absVar,
         credit_in_account_currency: variance > 0 ? absVar : 0
       });
    }

    const je: JournalEntry = {
      title: `Goods Receipt ${payload.receptionNumber}`,
      company: 'ModBM',
      posting_date: new Date().toISOString().slice(0, 10),
      user_remark: `Auto-generated for Goods Receipt ${payload.receptionNumber}`,
      accounts
    };

    await erpClient.createJournalEntry(je);
    console.log(`Created Journal Entry for Goods Receipt ${payload.receptionNumber}`);

  } else if (type === 'goods_dispatched') {
    let totalCogs = 0;
    if (payload.cogsDetails) {
        payload.cogsDetails.forEach((c: any) => { totalCogs += parseFloat(c.cogsAmount || '0'); });
    }

    if (totalCogs === 0) return;

    const je: JournalEntry = {
      title: `Goods Dispatched ${payload.shipmentNumber}`,
      company: 'ModBM',
      posting_date: new Date().toISOString().slice(0, 10),
      user_remark: `Auto-generated for Shipment ${payload.shipmentNumber}`,
      accounts: [
         { account: 'Cost of Goods Sold', debit_in_account_currency: totalCogs, credit_in_account_currency: 0 },
         { account: 'Inventory', debit_in_account_currency: 0, credit_in_account_currency: totalCogs }
      ]
    };

    await erpClient.createJournalEntry(je);
    console.log(`Created Journal Entry for Shipment ${payload.shipmentNumber}`);
  }
}

// Start Worker
const worker = new Worker('erpnext-sync', processEvent, { connection, concurrency: 5 });

worker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed with error:`, err.message);
});

// Start Express for Metrics
const app = express();
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
app.listen(PORT, () => {
  console.log(`Worker running... Metrics on port ${PORT}`);
});

// Start Polling
setInterval(pollOutbox, 5000);
pollOutbox(); // Initial poll
