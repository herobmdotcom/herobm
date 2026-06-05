import { TestingModule } from '@nestjs/testing';
import { createE2eModule } from './utils/e2e-module';
import { INestApplication } from '@nestjs/common';
import './suite-setup';
import request from 'supertest';
import { DRIZZLE } from '../src/drizzle/drizzle.module';
import {
  glAccounts,
  bankStatementLines,
  glJournalEntries,
  glJournalLines,
  glReconciliations,
} from '../src/drizzle/modbm-core-schema';
import { eq } from 'drizzle-orm';
import { RECONCILIATION_STATE } from '@modbm/shared';

describe('BankStatementController (e2e)', () => {
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

    const db = app.get(DRIZZLE);

    const inserted = await db
      .insert(glAccounts)
      .values({
        accountCode: '9998-STATEMENT',
        name: 'E2E Bank Statement Account',
        accountType: 'asset',
        currencyCode: 'AUD',
        isBankAccount: true,
        isGroup: false,
      })
      .onConflictDoUpdate({
        target: glAccounts.accountCode,
        set: { name: 'E2E Bank Statement Account' },
      })
      .returning();

    bankAccountId = inserted[0].glAccountId;
  });

  afterAll(async () => {
    await app.close();
  });

  it('should create bank lines in bulk', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/gl/bank-statement/lines/bulk')
      .set('Authorization', `Bearer ${adminToken}`)
      .send([
        {
          glAccountId: bankAccountId,
          date: '2026-06-01',
          description: 'Test Line 1',
          amount: 150.0,
          reference: 'Ref123',
        },
        {
          glAccountId: bankAccountId,
          date: '2026-06-02',
          description: 'Test Line 2',
          amount: -50.0,
          reference: 'Ref456',
        },
      ])
      .expect(201);

    expect(res.body.success).toBe(true);
  });

  it('should retrieve created bank lines', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/gl/bank-statement/lines?glAccountId=${bankAccountId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
    expect(res.body.some((l: any) => l.description === 'Test Line 1')).toBe(
      true,
    );
  });

  it('should match multiple lines perfectly', async () => {
    const db = app.get(DRIZZLE);

    // First retrieve the bank lines to get their IDs
    const linesRes = await request(app.getHttpServer())
      .get(`/api/gl/bank-statement/lines?glAccountId=${bankAccountId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    const bankLine1 = linesRes.body.find(
      (l: any) => l.description === 'Test Line 1',
    );
    const bankLine2 = linesRes.body.find(
      (l: any) => l.description === 'Test Line 2',
    );

    expect(bankLine1).toBeDefined();
    expect(bankLine2).toBeDefined();

    // Create a dummy journal entry with 2 lines that exactly matches the variance
    // Bank lines sum: 150 - 50 = 100
    // Journal lines should sum to 100 net debit (to match the bank side which is +100)
    const je = await db
      .insert(glJournalEntries)
      .values({
        entryNumber: 'JE-E2E-1234',
        entryDate: '2026-06-02',
        sourceType: 'manual',
        sourceId: '00000000-0000-0000-0000-000000000000',
      })
      .returning();

    const jl = await db
      .insert(glJournalLines)
      .values([
        {
          journalEntryId: je[0].journalEntryId,
          glAccountId: bankAccountId,
          debit: '100.00',
          credit: '0.00',
          memo: 'Dummy match line',
        },
      ])
      .returning();

    const rec = await db
      .insert(glReconciliations)
      .values({
        glAccountId: bankAccountId,
        statementDate: '2026-06-02',
        statementBalance: '1000.00',
        status: RECONCILIATION_STATE.DRAFT,
      })
      .returning();

    // Perform bulk match
    const matchRes = await request(app.getHttpServer())
      .post('/api/gl/bank-statement/match-bulk')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        bankLineIds: [bankLine1.lineId, bankLine2.lineId],
        journalLineIds: [jl[0].journalLineId],
        reconciliationId: rec[0].reconciliationId,
      });

    if (matchRes.status !== 201) {
      console.error('Match failed:', matchRes.body);
    }
    expect(matchRes.status).toBe(201);
    expect(matchRes.body.success).toBe(true);

    // Since we queried without explicit matchGroupId we'll just check the specific lines
    const bank1After = await db
      .select()
      .from(bankStatementLines)
      .where(eq(bankStatementLines.lineId, bankLine1.lineId));
    expect(bank1After[0].isReconciled).toBe(true);
    expect(bank1After[0].matchGroupId).toBeDefined();

    const journalAfter = await db
      .select()
      .from(glJournalLines)
      .where(eq(glJournalLines.journalLineId, jl[0].journalLineId));
    expect(journalAfter[0].matchGroupId).toBe(bank1After[0].matchGroupId);
  });
});
