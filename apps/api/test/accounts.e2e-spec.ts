import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest');

describe('Accounts (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let viewerToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    // Login as admin
    const adminRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        username: 'admin',
        password: process.env.DEV_ADMIN_PASSWORD || 'password',
      });
    if (adminRes.status !== 201) {
      console.error('Admin login failed:', adminRes.status, adminRes.body);
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
      console.error('Viewer login failed:', viewerRes.status, viewerRes.body);
    }
    viewerToken = viewerRes.body.access_token;
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/accounts — returns a list of accounts (viewer)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/accounts')
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/accounts/:id — returns a legacy account (viewer)', async () => {
    // 1. Find a legacy account ID
    const listRes = await request(app.getHttpServer())
      .get('/api/accounts')
      .set('Authorization', `Bearer ${viewerToken}`);

    const legacyAccount = listRes.body.data.find(
      (a: any) => a.source === 'abm',
    );

    if (!legacyAccount) {
      console.warn(
        'No legacy account found in test data, skipping GET by ID test',
      );
      return;
    }

    // 2. Fetch by ID
    const res = await request(app.getHttpServer())
      .get(`/api/accounts/${legacyAccount.accountId}`)
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.accountId).toBe(legacyAccount.accountId);
    expect(res.body.source).toBe('abm');
  });

  it('POST /api/accounts — creates a new account (admin)', async () => {
    const accountNumber = `E2E-CUST-${Date.now()}`;
    const res = await request(app.getHttpServer())
      .post('/api/accounts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        accountNumber,
        name: 'E2E Test Customer',
        emailAddress1: 'e2e@example.com',
      });

    expect(res.status).toBe(201);
    expect(res.body.accountId).toBeDefined();
    expect(res.body.accountNumber).toBe(accountNumber);
  });

  it('POST /api/accounts — fails with 403 (viewer)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/accounts')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({
        accountNumber: 'FAIL-CUST-001',
        name: 'Unauthorized Customer',
      });

    expect(res.status).toBe(403);
  });

  it('PATCH /api/accounts/:id — updates an account (admin)', async () => {
    // 1. Create account
    const createRes = await request(app.getHttpServer())
      .post('/api/accounts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        accountNumber: `PATCH-CUST-${Date.now()}`,
        name: 'Before Patch',
      });
    const accountId = createRes.body.accountId;

    // 2. Update account
    const res = await request(app.getHttpServer())
      .patch(`/api/accounts/${accountId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'After Patch',
        notes: 'Testing patching',
      });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('After Patch');
    expect(res.body.notes).toBe('Testing patching');
  });

  it('PATCH /api/accounts/:id — fails on legacy account (admin)', async () => {
    // 1. Find a legacy account
    const listRes = await request(app.getHttpServer())
      .get('/api/accounts?limit=50')
      .set('Authorization', `Bearer ${adminToken}`);

    const legacyAccount = listRes.body.data.find(
      (a: any) => a.source === 'abm',
    );

    if (!legacyAccount) {
      console.warn(
        'No legacy accounts found in test environment, skipping legacy patch test',
      );
      return;
    }

    // 2. Attempt to update
    const res = await request(app.getHttpServer())
      .patch(`/api/accounts/${legacyAccount.accountId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Should Fail' });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain(
      'legacy ABM record and cannot be edited',
    );
  });
});
