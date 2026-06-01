import { TestingModule } from '@nestjs/testing';
import { createE2eModule } from './utils/e2e-module';
import { INestApplication } from '@nestjs/common';
import './suite-setup';
import request from 'supertest';
import { DRIZZLE } from '../src/drizzle/drizzle.module';
import {
  glAccounts,
  reconciliationRules,
  csvMappingProfiles,
} from '../src/drizzle/modbm-core-schema';

describe('BankFeedsController (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let bankAccountId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await (
      await createE2eModule()
    ).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    // Login
    const adminRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        username: 'admin',
        password: process.env.DEV_ADMIN_PASSWORD || 'password',
      });

    adminToken = adminRes.body.access_token;

    // Insert bank account directly to avoid any group account issues
    const db = app.get(DRIZZLE);

    const inserted = await db
      .insert(glAccounts)
      .values({
        accountCode: '9999-BANK',
        name: 'E2E Bank Account',
        accountType: 'asset',
        currencyCode: 'AUD',
        isBankAccount: true,
        isGroup: false,
      })
      .onConflictDoUpdate({
        target: glAccounts.accountCode,
        set: { name: 'E2E Bank Account' },
      })
      .returning();

    bankAccountId = inserted[0].glAccountId;

    // Clean up any previously created rules or profiles from failed tests
    await db.delete(reconciliationRules);
    await db.delete(csvMappingProfiles);
  });

  afterAll(async () => {
    await app.close();
  });

  it('should parse CSV headers correctly', async () => {
    const csvBuffer = Buffer.from(
      'Date,Amount,Description\n2023-01-01,100,Test',
    );
    const res = await request(app.getHttpServer())
      .post('/api/gl/bank-feeds/parse')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', csvBuffer, 'test.csv')
      .expect(201);

    expect(res.body.headers).toBeDefined();
    expect(res.body.headers).toEqual(
      expect.arrayContaining(['Date', 'Amount', 'Description']),
    );
    expect(res.body.sampleRows).toHaveLength(1);
  });

  let profileId: string;
  it('should create a mapping profile', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/gl/bank-feeds/profiles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        glAccountId: bankAccountId,
        name: 'Test Profile',
        dateColumn: '0',
        amountColumn: '1',
        descriptionColumn: '2',
        headerRows: 1,
      })
      .expect(201);

    expect(res.body.profileId).toBeDefined();
    profileId = res.body.profileId;
  });

  it('should get mapping profiles', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/gl/bank-feeds/profiles/${bankAccountId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.find((p: any) => p.profileId === profileId)).toBeDefined();
  });

  let targetAccountId: string;
  it('should create a reconciliation rule', async () => {
    const db = app.get(DRIZZLE);
    const targetInserted = await db
      .insert(glAccounts)
      .values({
        accountCode: '8888-TARGET',
        name: 'E2E Target Account',
        accountType: 'expense',
        currencyCode: 'AUD',
        isGroup: false,
        isBankAccount: false,
      })
      .onConflictDoUpdate({
        target: glAccounts.accountCode,
        set: { name: 'E2E Target Account' },
      })
      .returning();

    targetAccountId = targetInserted[0].glAccountId;

    const res = await request(app.getHttpServer())
      .post('/api/gl/bank-feeds/rules')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        conditionType: 'contains',
        conditionValue: 'STRIPE PAYOUT',
        targetGlAccountId: targetAccountId,
      })
      .expect(201);

    expect(res.body.ruleId).toBeDefined();
  });

  it('should import CSV and auto-match rules', async () => {
    const csvBuffer = Buffer.from(
      'Date,Amount,Description\n2026-05-25,150.00,STRIPE PAYOUT\n2026-05-26,-50.00,UNKNOWN FEE',
    );

    const res = await request(app.getHttpServer())
      .post('/api/gl/bank-feeds/import')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('glAccountId', bankAccountId)
      .field('profileId', profileId)
      .attach('file', csvBuffer, 'statement.csv');

    if (res.status !== 201) console.error('Import Error:', res.body);
    expect(res.status).toBe(201);

    expect(res.body.autoMatchedCount).toBe(1);
    expect(res.body.unmatchedCount).toBe(1);
  });
});
