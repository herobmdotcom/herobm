import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../../../.env') });

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { Queue, Worker } from 'bullmq';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { pollOutbox, processEvent } from '../src/relay.service';

import { outbox, modbmCore } from '../src/schema';

describe('Worker E2E - Outbox Integration', () => {
  let pgClient: postgres.Sql;
  let db: any;
  let queue: Queue;
  let worker: Worker;
  
  // Mock the ERP client
  const mockErpClient = {
    createJournalEntry: vi.fn().mockResolvedValue(true)
  };

  beforeAll(async () => {
    const pgUser = process.env.POSTGRES_USER;
    const pgPass = process.env.POSTGRES_PASSWORD;
    const pgHost = process.env.POSTGRES_HOST || 'localhost';
    const pgPort = process.env.POSTGRES_PORT || '5432';
    const pgDb = process.env.POSTGRES_DB || 'custom_app';

    pgClient = postgres(`postgres://${pgUser}:${pgPass}@${pgHost}:${pgPort}/${pgDb}`);
    db = drizzle(pgClient, { schema: { modbmCore, outbox } });

    const redisHost = process.env.REDIS_HOST || 'localhost';
    const redisPassword = process.env.REDIS_PASSWORD;
    const connection = { host: redisHost, port: 6379, password: redisPassword };

    queue = new Queue('erpnext-sync-test', { connection });
    
    // Pass the mockErpClient when processing the event inside the worker
    worker = new Worker('erpnext-sync-test', async (job) => {
      await processEvent(job, mockErpClient);
    }, { connection });
    
    // Await ready
    await worker.waitUntilReady();
  });

  afterAll(async () => {
    // Cleanup BullMQ / Redis
    await worker.close();
    await queue.close();
    
    // Disconnect Postgres
    await pgClient.end();
  });

  it('should pull a goods_received event from outbox, queue it, and process it', async () => {
    const testEventId = randomUUID();
    
    // 1. Seed the raw row into the Postgres database.
    await db.insert(outbox).values({
      outboxId: testEventId,
      aggregateType: 'sales_order',
      aggregateId: randomUUID(),
      eventType: 'goods_received',
      payload: {
        receptionNumber: 'E2E-TESTING-001',
        inventoryValueAdded: '500',
        purchasePriceVariance: '0'
      }
    });

    // Promise that resolves when the worker successfully completes OUR job
    const jobCompletionPromise = new Promise<{ jobId: string }>((resolve) => {
      worker.on('completed', (job) => {
        if (job.id === testEventId) {
          resolve({ jobId: job.id });
        }
      });
    });

    // 2. Trigger the manual polling loop (simulating the setInterval)
    await pollOutbox(db, queue);

    // 3. Await the worker actually finishing the job
    const { jobId } = await jobCompletionPromise;

    // 4. Assertions
    expect(jobId).toBe(testEventId); // Job ID matches the outbox ID for idempotency

    // Verify the mock intercept caught the proper output exactly once
    expect(mockErpClient.createJournalEntry).toHaveBeenCalledTimes(1);
    const args = mockErpClient.createJournalEntry.mock.calls[0][0];
    
    expect(args.title).toBe('Goods Receipt E2E-TESTING-001');
    expect(args.accounts[0].account).toBe('Inventory');
    expect(args.accounts[0].debit_in_account_currency).toBe(500);

    // Verify the database row was marked as processed
    const dbCheck = await db.select().from(outbox).where(eq(outbox.outboxId, testEventId));
    expect(dbCheck[0].processedAt).not.toBeNull();
  });
});
