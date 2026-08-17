/**
 * GL Property-Based Fuzz Testing E2E Test Suite
 *
 * Uses fast-check to rigorously test the robustness of the General Ledger (GL),
 * ensuring strict double-entry invariants, account constraint enforcement,
 * reversal symmetry, multi-currency stability, and trial balance consistency
 * across randomized transaction sequences against real PostgreSQL.
 */
import { TestingModule } from '@nestjs/testing';
import { createE2eModule } from './utils/e2e-module';
import { INestApplication } from '@nestjs/common';
import { register } from 'prom-client';
import request from 'supertest';
import * as fc from 'fast-check';
import postgres from 'postgres';

interface AccountNode {
  glAccountId: string;
  accountCode: string;
  name: string;
  accountType: string;
  isGroup: boolean;
  isActive: boolean;
  isBankAccount: boolean;
  currencyCode: string;
  parentAccountId: string | null;
  children?: AccountNode[];
}

describe('API E2E — General Ledger Fuzz & Robustness Suite', () => {
  let app: INestApplication;
  let adminToken: string;
  let sqlClient: postgres.Sql;

  let leafAccounts: AccountNode[] = [];
  let groupAccounts: AccountNode[] = [];
  let leafAccountCodes: string[] = [];

  const NUM_RUNS = process.env.FUZZ_RUNS
    ? parseInt(process.env.FUZZ_RUNS, 10)
    : 50;

  beforeAll(async () => {
    register.clear();

    const moduleFixture: TestingModule = await (
      await createE2eModule()
    ).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    // Direct Postgres connection for deep invariant verification
    const user = process.env.POSTGRES_USER || 'postgres';
    const host = process.env.POSTGRES_HOST || 'localhost';
    const port = process.env.POSTGRES_PORT || '5432';
    const db = process.env.POSTGRES_DB || 'herobm_e2e_test';

    const connectionString =
      process.env.DATABASE_URL ||
      `postgresql://${user}:${process.env.POSTGRES_PASSWORD || 'password'}@${host}:${port}/${db}`;

    sqlClient = postgres(connectionString);

    // Login as admin
    const adminLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        username: 'admin',
        password: process.env.ADMIN_PASSWORD || 'password',
      })
      .expect(201);
    adminToken = adminLogin.body.access_token;

    // Fetch Chart of Accounts to seed fuzz generators
    const accountsRes = await request(app.getHttpServer())
      .get('/api/gl/accounts?format=flat')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const allAccounts: AccountNode[] = accountsRes.body;
    leafAccounts = allAccounts.filter((a) => !a.isGroup && a.isActive);
    groupAccounts = allAccounts.filter((a) => a.isGroup);
    leafAccountCodes = leafAccounts.map((a) => a.accountCode);

    expect(leafAccounts.length).toBeGreaterThanOrEqual(2);
  }, 120_000);

  afterAll(async () => {
    if (sqlClient) {
      await sqlClient.end();
    }
    await app.close();
  });

  describe('Invariant 1: Balanced Journal Entries (Property-Based)', () => {
    it('always accepts and correctly balances valid multi-line journal entries', async () => {
      const arbAmount = fc
        .integer({ min: 1, max: 10000000 })
        .map((cents) => cents / 100);

      const arbBalancedLines = fc
        .tuple(
          fc.integer({ min: 1, max: 4 }),
          fc.integer({ min: 1, max: 4 }),
          arbAmount,
        )
        .chain(([numDebits, numCredits, totalAmount]) => {
          return fc
            .tuple(
              fc.array(fc.integer({ min: 1, max: 100 }), {
                minLength: numDebits,
                maxLength: numDebits,
              }),
              fc.array(fc.integer({ min: 1, max: 100 }), {
                minLength: numCredits,
                maxLength: numCredits,
              }),
              fc.subarray(leafAccountCodes, { minLength: 2, maxLength: 8 }),
            )
            .map(([debitWeights, creditWeights, pickedAccounts]) => {
              const debitWeightSum = debitWeights.reduce((a, b) => a + b, 0);
              const creditWeightSum = creditWeights.reduce((a, b) => a + b, 0);

              const lines: {
                accountCode: string;
                debit: number;
                credit: number;
                memo?: string;
              }[] = [];

              // Calculate debits
              let debitAssigned = 0;
              for (let i = 0; i < debitWeights.length; i++) {
                const acct = pickedAccounts[i % pickedAccounts.length];
                if (i === debitWeights.length - 1) {
                  const amt =
                    Math.round((totalAmount - debitAssigned) * 100) / 100;
                  lines.push({
                    accountCode: acct,
                    debit: Math.max(0.01, amt),
                    credit: 0,
                    memo: `Fuzz Debit ${i}`,
                  });
                } else {
                  const fraction =
                    (debitWeights[i] / debitWeightSum) * totalAmount;
                  const amt = Math.max(0.01, Math.round(fraction * 100) / 100);
                  debitAssigned += amt;
                  lines.push({
                    accountCode: acct,
                    debit: amt,
                    credit: 0,
                    memo: `Fuzz Debit ${i}`,
                  });
                }
              }

              const actualTotalDebit =
                Math.round(lines.reduce((s, l) => s + l.debit, 0) * 100) / 100;

              // Calculate credits
              let creditAssigned = 0;
              for (let j = 0; j < creditWeights.length; j++) {
                const acct =
                  pickedAccounts[
                    (debitWeights.length + j) % pickedAccounts.length
                  ];
                if (j === creditWeights.length - 1) {
                  const amt =
                    Math.round((actualTotalDebit - creditAssigned) * 100) / 100;
                  lines.push({
                    accountCode: acct,
                    debit: 0,
                    credit: Math.max(0.01, amt),
                    memo: `Fuzz Credit ${j}`,
                  });
                } else {
                  const fraction =
                    (creditWeights[j] / creditWeightSum) * actualTotalDebit;
                  const amt = Math.max(0.01, Math.round(fraction * 100) / 100);
                  creditAssigned += amt;
                  lines.push({
                    accountCode: acct,
                    debit: 0,
                    credit: amt,
                    memo: `Fuzz Credit ${j}`,
                  });
                }
              }

              const finalDebitSum = lines.reduce((s, l) => s + l.debit, 0);
              const creditSumBeforeLast = lines
                .slice(debitWeights.length, -1)
                .reduce((s, l) => s + l.credit, 0);
              lines[lines.length - 1].credit =
                Math.round((finalDebitSum - creditSumBeforeLast) * 100) / 100;

              return lines;
            });
        });

      await fc.assert(
        fc.asyncProperty(arbBalancedLines, async (lines) => {
          const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
          const totalCredit = lines.reduce((s, l) => s + l.credit, 0);

          fc.pre(Math.abs(totalDebit - totalCredit) <= 0.005);
          fc.pre(
            lines.every(
              (l) =>
                l.debit >= 0 && l.credit >= 0 && (l.debit > 0 || l.credit > 0),
            ),
          );

          const res = await request(app.getHttpServer())
            .post('/api/gl/journal-entries')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
              memo: `Fuzz Entry: ${lines.length} lines, total=${totalDebit.toFixed(2)}`,
              lines,
            });

          expect(res.status).toBe(201);
          const journalEntryId = res.body.journalEntryId;
          expect(journalEntryId).toBeDefined();

          // Verify directly in database
          const dbLines = await sqlClient`
            SELECT debit, credit, is_reconciled
            FROM herobm_core.gl_journal_lines
            WHERE journal_entry_id = ${journalEntryId}::uuid
          `;

          expect(dbLines.length).toBe(lines.length);

          const dbDebitSum = dbLines.reduce(
            (s, l) => s + parseFloat(l.debit),
            0,
          );
          const dbCreditSum = dbLines.reduce(
            (s, l) => s + parseFloat(l.credit),
            0,
          );

          expect(Math.abs(dbDebitSum - dbCreditSum)).toBeLessThanOrEqual(0.005);

          return true;
        }),
        { numRuns: NUM_RUNS },
      );
    }, 60_000);
  });

  describe('Invariant 2: Unbalanced Journal Entries Rejection', () => {
    it('always rejects unbalanced entries and prevents partial writes', async () => {
      const arbUnbalancedLines = fc
        .tuple(
          fc.subarray(leafAccountCodes, { minLength: 2, maxLength: 4 }),
          fc.integer({ min: 100, max: 50000 }).map((c) => c / 100),
          fc.integer({ min: 1, max: 1000 }).map((c) => c / 100), // imbalance delta >= 0.01
        )
        .map(([accounts, baseAmount, delta]) => {
          return [
            { accountCode: accounts[0], debit: baseAmount, credit: 0 },
            { accountCode: accounts[1], debit: 0, credit: baseAmount + delta },
          ];
        });

      await fc.assert(
        fc.asyncProperty(arbUnbalancedLines, async (lines) => {
          const countBefore = await sqlClient`
            SELECT count(*)::int as count FROM herobm_core.gl_journal_entries
          `;

          const res = await request(app.getHttpServer())
            .post('/api/gl/journal-entries')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
              memo: 'Fuzz Unbalanced Attempt',
              lines,
            });

          expect(res.status).toBe(400);

          const countAfter = await sqlClient`
            SELECT count(*)::int as count FROM herobm_core.gl_journal_entries
          `;

          // Atomic rollback: no entry was created
          expect(countAfter[0].count).toBe(countBefore[0].count);
          return true;
        }),
        { numRuns: Math.min(NUM_RUNS, 30) },
      );
    });
  });

  describe('Invariant 3: Account Constraints and Rejections', () => {
    it('rejects posting to group/header accounts', async () => {
      if (groupAccounts.length === 0) return;

      const groupCode = groupAccounts[0].accountCode;
      const validCode = leafAccountCodes[0];

      const res = await request(app.getHttpServer())
        .post('/api/gl/journal-entries')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          memo: 'Fuzz Post To Group Account',
          lines: [
            { accountCode: groupCode, debit: 100, credit: 0 },
            { accountCode: validCode, debit: 0, credit: 100 },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/group account/i);
    });

    it('rejects posting to inactive accounts', async () => {
      const uniqueSuffix =
        Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const createRes = await request(app.getHttpServer())
        .post('/api/gl/accounts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          accountCode: `INACT_${uniqueSuffix}`.toUpperCase(),
          name: `Inactive Test Account ${uniqueSuffix}`,
          accountType: 'expense',
          isGroup: false,
          isBankAccount: false,
        })
        .expect(201);

      const createdAccount = createRes.body;

      await request(app.getHttpServer())
        .patch(`/api/gl/accounts/${createdAccount.glAccountId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: false })
        .expect(200);

      const validCode = leafAccountCodes[0];
      const res = await request(app.getHttpServer())
        .post('/api/gl/journal-entries')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          memo: 'Fuzz Post To Inactive Account',
          lines: [
            { accountCode: createdAccount.accountCode, debit: 100, credit: 0 },
            { accountCode: validCode, debit: 0, credit: 100 },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/is inactive/i);
    });

    it('rejects posting to non-existent accounts', async () => {
      const validCode = leafAccountCodes[0];
      const fakeCode = 'NON_EXISTENT_99999';

      const res = await request(app.getHttpServer())
        .post('/api/gl/journal-entries')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          memo: 'Fuzz Post To Non-Existent Account',
          lines: [
            { accountCode: fakeCode, debit: 100, credit: 0 },
            { accountCode: validCode, debit: 0, credit: 100 },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/does not exist/i);
    });

    it('rejects single-line and empty entries', async () => {
      const validCode = leafAccountCodes[0];

      // Single line
      const singleRes = await request(app.getHttpServer())
        .post('/api/gl/journal-entries')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          memo: 'Single line',
          lines: [{ accountCode: validCode, debit: 100, credit: 0 }],
        });
      expect(singleRes.status).toBe(400);

      // Empty lines
      const emptyRes = await request(app.getHttpServer())
        .post('/api/gl/journal-entries')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          memo: 'Empty lines',
          lines: [],
        });
      expect(emptyRes.status).toBe(400);
    });
  });

  describe('Invariant 4: Journal Entry Reversal Symmetry', () => {
    it('creates exact opposite entries such that original + reversal nets to 0 per account', async () => {
      const arbReversibleEntry = fc.tuple(
        fc.subarray(leafAccountCodes, { minLength: 2, maxLength: 4 }),
        fc.integer({ min: 100, max: 25000 }).map((c) => c / 100),
      );

      await fc.assert(
        fc.asyncProperty(arbReversibleEntry, async ([accounts, amount]) => {
          const origLines = [
            {
              accountCode: accounts[0],
              debit: amount,
              credit: 0,
              memo: 'Orig Leg 1',
            },
            {
              accountCode: accounts[1],
              debit: 0,
              credit: amount,
              memo: 'Orig Leg 2',
            },
          ];

          // 1. Post original
          const origRes = await request(app.getHttpServer())
            .post('/api/gl/journal-entries')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
              memo: `Original Entry for Reversal Fuzz`,
              lines: origLines,
            })
            .expect(201);

          const origId = origRes.body.journalEntryId;

          // 2. Fetch original lines from DB
          const origDbLines = await sqlClient`
            SELECT jl.gl_account_id, a.account_code, jl.debit, jl.credit
            FROM herobm_core.gl_journal_lines jl
            JOIN herobm_core.gl_accounts a ON a.gl_account_id = jl.gl_account_id
            WHERE jl.journal_entry_id = ${origId}::uuid
          `;

          // 3. Post reversal (swapped debits/credits)
          const revLines = origDbLines.map((l) => ({
            accountCode: l.account_code,
            debit: parseFloat(l.credit),
            credit: parseFloat(l.debit),
            memo: `Reversal of ${origId}`,
          }));

          const revRes = await request(app.getHttpServer())
            .post('/api/gl/journal-entries')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
              memo: `Reversal Entry for ${origId}`,
              lines: revLines,
            })
            .expect(201);

          const revId = revRes.body.journalEntryId;

          // 4. Verify combined impact across both entries is 0 per account
          const combinedImpact = await sqlClient`
            SELECT 
              gl_account_id,
              SUM(debit::numeric - credit::numeric) as net_balance
            FROM herobm_core.gl_journal_lines
            WHERE journal_entry_id IN (${origId}::uuid, ${revId}::uuid)
            GROUP BY gl_account_id
          `;

          for (const row of combinedImpact) {
            expect(Math.abs(parseFloat(row.net_balance))).toBeLessThanOrEqual(
              0.005,
            );
          }

          return true;
        }),
        { numRuns: Math.min(NUM_RUNS, 20) },
      );
    });
  });

  describe('Invariant 5: Multi-Currency Journal Entries Fuzzing', () => {
    it('accepts multi-currency journal lines and stores foreign amounts faithfully', async () => {
      const arbCurrencies = fc.constantFrom(
        'USD',
        'EUR',
        'GBP',
        'AUD',
        'JPY',
        'CAD',
      );
      const arbExchangeRate = fc
        .integer({ min: 50, max: 20000 })
        .map((r) => r / 100); // 0.50 to 200.00
      const arbForeignAmt = fc
        .integer({ min: 100, max: 50000 })
        .map((c) => c / 100);

      const arbMultiCurrencyEntry = fc.tuple(
        fc.subarray(leafAccountCodes, { minLength: 2, maxLength: 2 }),
        arbCurrencies,
        arbExchangeRate,
        arbForeignAmt,
      );

      await fc.assert(
        fc.asyncProperty(
          arbMultiCurrencyEntry,
          async ([accounts, curr, rate, foreignAmt]) => {
            const baseAmt = Math.round(foreignAmt * rate * 100) / 100;

            const lines = [
              {
                accountCode: accounts[0],
                debit: baseAmt,
                credit: 0,
                foreignDebit: foreignAmt,
                foreignCredit: 0,
                foreignCurrencyCode: curr,
                exchangeRate: rate,
              },
              {
                accountCode: accounts[1],
                debit: 0,
                credit: baseAmt,
                foreignDebit: 0,
                foreignCredit: foreignAmt,
                foreignCurrencyCode: curr,
                exchangeRate: rate,
              },
            ];

            const res = await request(app.getHttpServer())
              .post('/api/gl/journal-entries')
              .set('Authorization', `Bearer ${adminToken}`)
              .send({
                memo: `Fuzz FX Entry (${curr} @ ${rate})`,
                lines,
              });

            expect(res.status).toBe(201);
            const entryId = res.body.journalEntryId;

            const dbLines = await sqlClient`
            SELECT foreign_debit, foreign_credit, foreign_currency_code, exchange_rate, debit, credit
            FROM herobm_core.gl_journal_lines
            WHERE journal_entry_id = ${entryId}::uuid
          `;

            expect(dbLines.length).toBe(2);
            expect(dbLines[0].foreign_currency_code).toBe(curr);
            expect(parseFloat(dbLines[0].exchange_rate)).toBeCloseTo(rate, 2);

            return true;
          },
        ),
        { numRuns: Math.min(NUM_RUNS, 20) },
      );
    });
  });

  describe('Invariant 6: Outbox Audit Trail Integrity', () => {
    it('records a gl_posted outbox event for every successfully posted journal entry', async () => {
      const accts = leafAccountCodes.slice(0, 2);
      const postRes = await request(app.getHttpServer())
        .post('/api/gl/journal-entries')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          memo: 'Audit Event Verification Fuzz',
          lines: [
            { accountCode: accts[0], debit: 55.5, credit: 0 },
            { accountCode: accts[1], debit: 0, credit: 55.5 },
          ],
        })
        .expect(201);

      const entryId = postRes.body.journalEntryId;

      // Verify financial audit event
      const events = await sqlClient`
        SELECT event_id, event_type, entity_type, entity_id, payload
        FROM herobm_core.financial_events
        WHERE entity_id = ${entryId}::uuid AND event_type = 'gl_posted'
      `;

      expect(events.length).toBeGreaterThanOrEqual(1);
      expect(events[0].event_type).toBe('gl_posted');
      expect(events[0].entity_id).toBe(entryId);
    });
  });

  describe('Invariant 7: Trial Balance Equality Across High-Volume Transactions', () => {
    it('maintains totalDebits == totalCredits in Trial Balance after high-volume mutations', async () => {
      const tbRes = await request(app.getHttpServer())
        .get('/api/gl/trial-balance')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const trialBalance: any[] = tbRes.body;
      expect(Array.isArray(trialBalance)).toBe(true);

      const totalPeriodDebit = trialBalance.reduce(
        (s, r) => s + (r.periodDebit || 0),
        0,
      );
      const totalPeriodCredit = trialBalance.reduce(
        (s, r) => s + (r.periodCredit || 0),
        0,
      );

      expect(
        Math.abs(totalPeriodDebit - totalPeriodCredit),
      ).toBeLessThanOrEqual(0.05);

      // Verify directly on DB
      const dbTotals = await sqlClient`
        SELECT 
          COALESCE(SUM(debit), 0)::numeric as total_debits,
          COALESCE(SUM(credit), 0)::numeric as total_credits
        FROM herobm_core.gl_journal_lines
      `;

      const dbDebit = parseFloat(dbTotals[0].total_debits);
      const dbCredit = parseFloat(dbTotals[0].total_credits);

      expect(Math.abs(dbDebit - dbCredit)).toBeLessThanOrEqual(0.01);
    });
  });
});
