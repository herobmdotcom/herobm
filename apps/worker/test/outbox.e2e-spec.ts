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

import { outbox, modbmCore, accounts, webhooks } from '../src/schema';

describe('Worker E2E - Outbox Integration', () => {
  let pgClient: postgres.Sql;
  let db: any;
  let queue: Queue;
  let worker: Worker;
  

  beforeAll(async () => {
    const pgUser = process.env.POSTGRES_USER;
    const pgPass = process.env.POSTGRES_PASSWORD;
    const pgHost = process.env.POSTGRES_HOST || 'localhost';
    const pgPort = process.env.POSTGRES_PORT || '5432';
    const pgDb = process.env.POSTGRES_DB || 'custom_app';

    pgClient = postgres(`postgres://${pgUser}:${pgPass}@${pgHost}:${pgPort}/${pgDb}`);
    db = drizzle(pgClient, { schema: { modbmCore, outbox, accounts, webhooks } });

    const redisHost = process.env.REDIS_HOST || 'localhost';
    const redisPassword = process.env.REDIS_PASSWORD;
    const connection = { host: redisHost, port: 6379, password: redisPassword };

    queue = new Queue('external-sync-test-2', { connection });
    
    // Explicitly pass db to processEvent! (Solves ADV-062)
    worker = new Worker('external-sync-test-2', async (job) => {
      await processEvent(job, db);
    }, { connection });
    
    await worker.waitUntilReady();
  });

  afterAll(async () => {
    await worker.close();
    await queue.close();
    await pgClient.end();
  });


  it('should leave processedAt null if BullMQ crashes or sync fails (ADV-064)', async () => {
    const pEventId = randomUUID();

    await db.insert(outbox).values({
      outboxId: pEventId,
      aggregateType: 'sales_order',
      aggregateId: randomUUID(),
      eventType: 'sales_order.created',
      payload: {
        customerId: randomUUID(),
        customerName: 'Fail Corp'
      }
    });

    // Mock BullMQ add to completely fail (simulate Redis drop)
    const spy = vi.spyOn(queue, 'add').mockRejectedValueOnce(new Error('Redis Connection Error'));

    await pollOutbox(db, queue);

    const dbCheck = await db.select().from(outbox).where(eq(outbox.outboxId, pEventId));
    
    // ProcessedAt must strictly be null, as it was never successfully enqueued/processed
    expect(dbCheck[0].processedAt).toBeNull();
    // It shouldn't even be locked, or if it locked before failing, the failure caught it.
    // However, our code currently queues THEN locks. If queue throws, it doesn't lock.
    expect(dbCheck[0].lockedUntil).toBeNull();

    spy.mockRestore();
  });

  it('should process event and dispatch to matching webhook', async () => {
    const testEventId = randomUUID();
    const testWebhookId = randomUUID();

    // 1. Insert a webhook
    await db.insert(webhooks).values({
      webhookId: testWebhookId,
      targetUrl: 'https://e2e-webhook.test/endpoint',
      secretKey: 'e2e-secret',
      eventTypes: ['sales_order.created'],
      isActive: true,
      description: 'E2E Test Webhook',
      createdOn: new Date(),
      modifiedOn: new Date()
    });

    // 2. Insert outbox event
    await db.insert(outbox).values({
      outboxId: testEventId,
      aggregateType: 'sales_order',
      aggregateId: randomUUID(),
      eventType: 'sales_order.created',
      payload: {
        orderNumber: 'SO-E2E'
      }
    });

    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
    } as Response);

    const jobCompletionPromise = new Promise<{ jobId: string }>((resolve) => {
      worker.on('completed', (job) => {
        if (job.id === testEventId) resolve({ jobId: job.id });
      });
    });

    await pollOutbox(db, queue);
    const { jobId } = await jobCompletionPromise;

    expect(jobId).toBe(testEventId);

    // 3. Verify fetch was called
    expect(fetchSpy).toHaveBeenCalledWith('https://e2e-webhook.test/endpoint', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        'Content-Type': 'application/json',
        'x-modbm-signature': expect.any(String)
      }),
      body: expect.stringContaining('"eventType":"sales_order.created"')
    }));

    // 4. Verify outbox processedAt
    const dbCheck = await db.select().from(outbox).where(eq(outbox.outboxId, testEventId));
    expect(dbCheck[0].processedAt).not.toBeNull();
    
    // Cleanup
    await db.delete(webhooks).where(eq(webhooks.webhookId, testWebhookId));
    fetchSpy.mockRestore();
  });
});
