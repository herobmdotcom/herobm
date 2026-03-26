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

import { outbox, modbmCore, accounts } from '../src/schema';

describe('Worker E2E - Outbox Integration', () => {
  let pgClient: postgres.Sql;
  let db: any;
  let queue: Queue;
  let worker: Worker;
  
  // Mock the ERP client
  const mockErpClient = {
    createResource: vi.fn().mockResolvedValue({ name: 'ERP-CUST-123' })
  };

  beforeAll(async () => {
    const pgUser = process.env.POSTGRES_USER;
    const pgPass = process.env.POSTGRES_PASSWORD;
    const pgHost = process.env.POSTGRES_HOST || 'localhost';
    const pgPort = process.env.POSTGRES_PORT || '5432';
    const pgDb = process.env.POSTGRES_DB || 'custom_app';

    pgClient = postgres(`postgres://${pgUser}:${pgPass}@${pgHost}:${pgPort}/${pgDb}`);
    db = drizzle(pgClient, { schema: { modbmCore, outbox, accounts } });

    const redisHost = process.env.REDIS_HOST || 'localhost';
    const redisPassword = process.env.REDIS_PASSWORD;
    const connection = { host: redisHost, port: 6379, password: redisPassword };

    queue = new Queue('erpnext-sync-test-2', { connection });
    
    // Explicitly pass db to processEvent! (Solves ADV-062)
    worker = new Worker('erpnext-sync-test-2', async (job) => {
      await processEvent(job, mockErpClient, db);
    }, { connection });
    
    await worker.waitUntilReady();
  });

  afterAll(async () => {
    await worker.close();
    await queue.close();
    await pgClient.end();
  });

  it('should process sales_invoiced event and JIT sync customer', async () => {
    const testEventId = randomUUID();
    const testCustomerId = randomUUID();

    // Setup an account record to be JIT-synced
    await db.insert(accounts).values({
      accountId: testCustomerId,
      accountNumber: 'E2E-1234',
      name: 'E2E Corp',
      erpnextId: null,
    });
    
    await db.insert(outbox).values({
      outboxId: testEventId,
      aggregateType: 'sales_order',
      aggregateId: randomUUID(),
      eventType: 'sales_invoiced',
      payload: {
        customerId: testCustomerId,
        customerName: 'E2E Corp'
      }
    });

    const jobCompletionPromise = new Promise<{ jobId: string }>((resolve) => {
      worker.on('completed', (job) => {
        if (job.id === testEventId) resolve({ jobId: job.id });
      });
    });

    await pollOutbox(db, queue);
    const { jobId } = await jobCompletionPromise;

    expect(jobId).toBe(testEventId); 

    expect(mockErpClient.createResource).toHaveBeenCalledWith('Customer', {
       customer_name: 'E2E Corp',
       customer_type: 'Company',
       customer_group: 'Commercial',
       territory: 'All Territories'
    });

    // Check that DB was actually updated!
    const accountCheck = await db.select().from(accounts).where(eq(accounts.accountId, testCustomerId));
    expect(accountCheck[0].erpnextId).toBe('ERP-CUST-123');

    const dbCheck = await db.select().from(outbox).where(eq(outbox.outboxId, testEventId));
    expect(dbCheck[0].processedAt).not.toBeNull();
  });
});
