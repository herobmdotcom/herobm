import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest');
import { AppModule } from '../src/app.module';
import { DrizzleDB, DRIZZLE } from '../src/drizzle/drizzle.module';
import { apiKeys, webhooks, outbox } from '../src/drizzle/modbm-core-schema';
import * as bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { processEvent } from '../../worker/src/relay.service';
import express from 'express';
import { WebhookReceiver } from '../../../packages/sdk/src/server/WebhookReceiver';

describe('Events (e2e)', () => {
  let app: INestApplication;
  let db: DrizzleDB;
  let server: any;
  const rawKey = 'super-secret-events-key-' + Date.now();
  let webhookSecret: string;
  let expressApp: any;
  let expressServer: any;
  let receivedPayload: any = null;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    db = app.get<DrizzleDB>(DRIZZLE);
    server = app.getHttpServer();

    const keyHash = await bcrypt.hash(rawKey, 10);
    await db.insert(apiKeys).values({
      name: 'Events Test Key',
      keyHash,
      prefix: rawKey.substring(0, 4),
      role: 'admin',
      isActive: true,
      createdBy: 'test',
    });

    // Create a webhook subscription for testing
    const res = await request(server)
      .post('/api/webhooks')
      .set('x-api-key', rawKey)
      .send({
        targetUrl: 'http://127.0.0.1:4005/webhook', // Dummy test server
        eventTypes: ['test.event'],
      });

    webhookSecret = res.body.secretKey;

    // Start a mock Express server to receive the webhook using the new SDK
    expressApp = express();
    const receiver = new WebhookReceiver({ secret: webhookSecret });

    receiver.on('test.event', (payload) => {
      receivedPayload = payload;
    });

    expressApp.post('/webhook', express.json(), receiver.expressMiddleware());
    expressServer = expressApp.listen(4005);
  });

  afterAll(async () => {
    expressServer?.close();
    await db.delete(webhooks);
    await db.delete(outbox);
    await db.delete(apiKeys).where(eq(apiKeys.prefix, rawKey.substring(0, 4)));
    await app.close();
  });

  it('should publish an event and dispatch it to WebhookReceiver', async () => {
    // 1. Publish Event via API
    const res = await request(server)
      .post('/api/events/publish')
      .set('x-api-key', rawKey)
      .send({
        type: 'test.event',
        payload: { message: 'hello world' },
      })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.outboxId).toBeDefined();

    // 2. Read from Outbox
    const events = await db
      .select()
      .from(outbox)
      .where(eq(outbox.outboxId, res.body.outboxId));
    expect(events.length).toBe(1);

    // 3. Simulate Worker Processing
    const mockJob = {
      data: {
        eventId: events[0].outboxId,
        type: events[0].eventType,
        payload: events[0].payload,
      },
    };
    const mockExtClient = {};

    await processEvent(mockJob as any, mockExtClient, db);

    // Give the async fetch inside processEvent a tiny moment to complete and hit our Express server
    await new Promise((resolve) => setTimeout(resolve, 500));

    // 4. Verify WebhookReceiver successfully handled it
    expect(receivedPayload).toBeDefined();
    expect(receivedPayload.message).toBe('hello world');
  });
});
