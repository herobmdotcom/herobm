/**
 * E2E Tests — General Ledger & Trial Balance
 */
import { TestingModule } from '@nestjs/testing';
import { createE2eModule } from './utils/e2e-module';
import { INestApplication } from '@nestjs/common';
import { register } from 'prom-client';
import { AppModule } from '../src/app.module';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest');

describe('API E2E — General Ledger', () => {
  let app: INestApplication;
  let adminToken: string;

  beforeAll(async () => {
    register.clear();

    const moduleFixture: TestingModule = await (await createE2eModule()).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    // Login as admin
    const adminLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: 'admin', password: process.env.DEV_ADMIN_PASSWORD })
      .expect(201);
    adminToken = adminLogin.body.access_token;
  }, 120_000);

  afterAll(async () => {
    await app.close();
  });

  describe('Manual Journal Entry and Trial Balance', () => {
    let debitAccountCode: string;
    let creditAccountCode: string;
    let createdEntryId: string;

    it('fetches leaf accounts to use for posting', async () => {
      // Get all accounts
      const accountsRes = await request(app.getHttpServer())
        .get('/api/gl/accounts')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Find two non-group (leaf) accounts to post to
      const walk = (nodes: any[], leaves: any[]) => {
        for (const node of nodes) {
          if (!node.isGroup) leaves.push(node);
          if (node.children && node.children.length > 0) {
            walk(node.children, leaves);
          }
        }
      };

      const leaves: any[] = [];
      walk(accountsRes.body, leaves);

      expect(leaves.length).toBeGreaterThanOrEqual(2);
      debitAccountCode = leaves[0].accountCode;
      creditAccountCode = leaves[1].accountCode;
    });

    it('posts a balanced manual journal entry successfully', async () => {
      const payload = {
        memo: 'Manual E2E Test Transfer',
        lines: [
          {
            accountCode: debitAccountCode,
            debit: 150.0,
            credit: 0,
            memo: 'Debit side E2E',
          },
          {
            accountCode: creditAccountCode,
            debit: 0,
            credit: 150.0,
            memo: 'Credit side E2E',
          },
        ],
      };

      const res = await request(app.getHttpServer())
        .post('/api/gl/journal-entries')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload)
        .expect(201);

      createdEntryId = res.body.journalEntryId;
      expect(createdEntryId).toBeDefined();
    });

    it('rejects an unbalanced manual journal entry', async () => {
      const payload = {
        memo: 'Invalid Unbalanced Transfer',
        lines: [
          {
            accountCode: debitAccountCode,
            debit: 150.0,
            credit: 0,
          },
          {
            accountCode: creditAccountCode,
            debit: 0,
            credit: 100.0, // Unbalanced
          },
        ],
      };

      await request(app.getHttpServer())
        .post('/api/gl/journal-entries')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload)
        .expect(400); // Bad Request expected
    });

    it('trial balance correctly reflects posted journal entry', async () => {
      // Wait to ensure timestamps align if necessary
      const res = await request(app.getHttpServer())
        .get('/api/gl/trial-balance')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const trialBalance = res.body;

      const debitNode = trialBalance.find(
        (node: any) => node.account_code === debitAccountCode,
      );
      const creditNode = trialBalance.find(
        (node: any) => node.account_code === creditAccountCode,
      );

      expect(debitNode).toBeDefined();
      expect(creditNode).toBeDefined();

      // Ensure their values represent the manual entry.
      // E2E db is dirty so we can only check they are >= 150 or exist.
      expect(parseFloat(debitNode.total_debit)).toBeGreaterThanOrEqual(150.0);
      expect(parseFloat(creditNode.total_credit)).toBeGreaterThanOrEqual(150.0);
    });
  });
});
