import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest');
import { AppModule } from '../src/app.module';
import { DrizzleDB, DRIZZLE } from '../src/drizzle/drizzle.module';
import { apiKeys, webhooks } from '../src/drizzle/herobm-core-schema';
import * as bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';

describe('Webhooks & API Keys (e2e)', () => {
  let app: INestApplication;
  let db: DrizzleDB;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let server: any;
  const rawKey = 'super-secret-test-key-' + Date.now();

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
      name: 'Test Key',
      keyHash,
      prefix: rawKey.substring(0, 4),
      role: 'admin',
      isActive: true,
      createdBy: 'test',
    });
  });

  afterAll(async () => {
    await db.delete(webhooks);
    await db.delete(apiKeys).where(eq(apiKeys.prefix, rawKey.substring(0, 4)));
    await app.close();
  });

  describe('API Keys Auth', () => {
    it('should reject without api key', () => {
      return request(server).get('/api/webhooks').expect(401);
    });

    it('should reject with invalid api key', () => {
      return request(server)
        .get('/api/webhooks')
        .set('x-api-key', 'invalid-api-key-string')
        .expect(401);
    });

    it('should accept with valid api key', () => {
      return request(server)
        .get('/api/webhooks')
        .set('x-api-key', rawKey)
        .expect(200);
    });
  });

  describe('Rate Limiting', () => {
    it('should allow more than 60 requests when using an API Key', async () => {
      // The default limit is 60, but API key limit is 1000.
      // We will make 65 requests. If they all pass, the distinct throttler works.
      const requests = Array.from({ length: 65 }).map(() =>
        request(server).get('/api/webhooks').set('x-api-key', rawKey),
      );

      const responses = await Promise.all(requests);
      const allPassed = responses.every((res) => res.status === 200);
      expect(allPassed).toBe(true);
    });
  });

  describe('Webhooks CRUD', () => {
    let webhookId: string;

    it('should create a webhook', async () => {
      const res = await request(server)
        .post('/api/webhooks')
        .set('x-api-key', rawKey)
        .send({
          targetUrl: 'https://example.com/hook',
          eventTypes: ['sales_invoiced'],
        })
        .expect(201);

      expect(res.body).toHaveProperty('webhookId');
      expect(res.body).toHaveProperty('secretKey'); // Secret key generated automatically
      webhookId = res.body.webhookId;
    });

    it('should list webhooks', async () => {
      const res = await request(server)
        .get('/api/webhooks')
        .set('x-api-key', rawKey)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(res.body.some((w: any) => w.webhookId === webhookId)).toBe(true);
    });

    it('should delete a webhook', async () => {
      await request(server)
        .delete(`/api/webhooks/${webhookId}`)
        .set('x-api-key', rawKey)
        .expect(200);
    });
  });
});
