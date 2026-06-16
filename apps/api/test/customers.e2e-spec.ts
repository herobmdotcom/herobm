import { TestingModule } from '@nestjs/testing';
import { createE2eModule } from './utils/e2e-module';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';

import request from 'supertest';

describe('Accounts (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let viewerToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await (
      await createE2eModule()
    ).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    // Login as admin
    const adminRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        username: 'admin',
        password: process.env.ADMIN_PASSWORD || 'password',
      });

    if (adminRes.status !== 201) {
      throw new Error(
        `${'adminRes'} login failed: ${adminRes.status} ${JSON.stringify(adminRes.body)}`,
      );
    }
    adminToken = adminRes.body.access_token;

    // Login as viewer
    const viewerRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        username: 'viewer',
        password: process.env.DEV_VIEWER_PASSWORD || 'password',
      });

    if (viewerRes.status !== 201) {
      throw new Error(
        `${'viewerRes'} login failed: ${viewerRes.status} ${JSON.stringify(viewerRes.body)}`,
      );
    }
    viewerToken = viewerRes.body.access_token;
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/accounts — returns a list of accounts (viewer)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/customers')
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/accounts/:id — returns an account by ID (viewer)', async () => {
    // 1. Find an account ID
    const listRes = await request(app.getHttpServer())
      .get('/api/customers')
      .set('Authorization', `Bearer ${viewerToken}`);

    const account = listRes.body.data[0];

    if (!account) {
      console.warn('No account found in test data, skipping GET by ID test');
      return;
    }

    // 2. Fetch by ID
    const res = await request(app.getHttpServer())
      .get(`/api/customers/${account.customerId}`)
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.customerId).toBe(account.customerId);
  });

  it('POST /api/accounts — creates a new account (admin)', async () => {
    const customerNumber = `E2E-CUST-${Date.now()}`;
    const res = await request(app.getHttpServer())
      .post('/api/customers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        billingAddressCountry: 'AU',
        customerNumber,
        name: 'E2E Test Customer',
        emailAddress1: 'e2e@example.com',
      });

    expect(res.status).toBe(201);
    expect(res.body.customerId).toBeDefined();
    expect(res.body.customerNumber).toBe(customerNumber);
  });

  it('POST /api/accounts — fails with 403 (viewer)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/customers')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({
        billingAddressCountry: 'AU',
        customerNumber: 'FAIL-CUST-001',
        name: 'Unauthorized Customer',
      });

    expect(res.status).toBe(403);
  });

  it('PATCH /api/accounts/:id — updates an account (admin)', async () => {
    // 1. Create account
    const createRes = await request(app.getHttpServer())
      .post('/api/customers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        billingAddressCountry: 'AU',
        customerNumber: `PATCH-CUST-${Date.now()}`,
        name: 'Before Patch',
      });
    const customerId = createRes.body.customerId;

    // 2. Update account
    const res = await request(app.getHttpServer())
      .patch(`/api/customers/${customerId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'After Patch',
        notes: 'Testing patching',
      });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('After Patch');
    expect(res.body.notes).toBe('Testing patching');
  });

  it('PATCH /api/accounts/:id — all accounts are now editable (admin)', async () => {
    // All accounts are first-class entities after ABM decommissioning
    const listRes = await request(app.getHttpServer())
      .get('/api/customers?limit=50')
      .set('Authorization', `Bearer ${adminToken}`);

    const account = listRes.body.data[0];

    if (!account) {
      console.warn('No accounts found in test environment, skipping edit test');
      return;
    }

    // All accounts should be editable now
    const res = await request(app.getHttpServer())
      .patch(`/api/customers/${account.customerId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ notes: 'E2E: verified editable' });

    expect(res.status).toBe(200);
    expect(res.body.notes).toBe('E2E: verified editable');
  });
});
