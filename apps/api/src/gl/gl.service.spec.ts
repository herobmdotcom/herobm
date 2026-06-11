import { Test, TestingModule } from '@nestjs/testing';
import { GlService } from './gl.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AppConfigService } from '../settings/app-config.service';
import { setupPgliteSuite } from '../test-utils/pglite-suite';
import { DataSourcesRegistry } from '../data-sources/data-sources.registry';
import {
  glAccounts,
  glJournalEntries,
  glJournalLines,
  costCenters,
  activities,
  glSettings,
} from '../drizzle/modbm-core-schema';
import { PgliteDatabase } from 'drizzle-orm/pglite';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

describe('GlService', () => {
  const pg = setupPgliteSuite({ skipSeeds: true });
  let service: GlService;

  beforeEach(async () => {
    // Clean tables for isolation
    await pg.db.delete(glJournalLines);
    await pg.db.delete(glJournalEntries);
    await pg.db.delete(glSettings);
    await pg.db.delete(glAccounts);
    await pg.db.delete(costCenters);
    await pg.db.delete(activities);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GlService,
        {
          provide: DataSourcesRegistry,
          useValue: { registerReport: jest.fn(), getReport: jest.fn() },
        },
        { provide: DRIZZLE, useValue: pg.db },
        {
          provide: AppConfigService,
          useValue: {
            homeCurrency: jest.fn().mockReturnValue('EUR'),
            inventoryAccountingMode: () => 'perpetual',
          },
        },
      ],
    }).compile();

    service = module.get<GlService>(GlService);
  });

  describe('postJournalEntry — balance invariant', () => {
    it('should reject null/undefined lines', async () => {
      await expect(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        service.postJournalEntry(null as any, { sourceType: 'manual' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject empty lines array', async () => {
      await expect(
        service.postJournalEntry([], { sourceType: 'manual' }),
      ).rejects.toThrow('at least 2 lines');
    });

    it('should reject a single line', async () => {
      await expect(
        service.postJournalEntry(
          [{ accountCode: '1100', debit: 100, credit: 0 }],
          { sourceType: 'manual' },
        ),
      ).rejects.toThrow('at least 2 lines');
    });

    it('should reject when debits exceed credits', async () => {
      await expect(
        service.postJournalEntry(
          [
            { accountCode: '1100', debit: 100, credit: 0 },
            { accountCode: '4100', debit: 0, credit: 50 },
          ],
          { sourceType: 'manual' },
        ),
      ).rejects.toThrow('unbalanced');
    });

    it('should reject when credits exceed debits', async () => {
      await expect(
        service.postJournalEntry(
          [
            { accountCode: '1100', debit: 50, credit: 0 },
            { accountCode: '4100', debit: 0, credit: 100 },
          ],
          { sourceType: 'manual' },
        ),
      ).rejects.toThrow('unbalanced');
    });

    it('should accept balanced entries (proceeds past balance check to account lookup)', async () => {
      await expect(
        service.postJournalEntry(
          [
            { accountCode: 'NON-EXISTENT-1', debit: 100, credit: 0 },
            { accountCode: 'NON-EXISTENT-2', debit: 0, credit: 100 },
          ],
          { sourceType: 'manual' },
        ),
      ).rejects.toThrow('does not exist');
    });

    it('should tolerate floating-point imprecision within 0.005', async () => {
      await expect(
        service.postJournalEntry(
          [
            { accountCode: 'NON-EXISTENT-1', debit: 0.1 + 0.2, credit: 0 },
            { accountCode: 'NON-EXISTENT-2', debit: 0, credit: 0.3 },
          ],
          { sourceType: 'manual' },
        ),
      ).rejects.toThrow('does not exist');
    });

    it('should reject imbalance beyond tolerance (0.01)', async () => {
      await expect(
        service.postJournalEntry(
          [
            { accountCode: '1100', debit: 100.01, credit: 0 },
            { accountCode: '4100', debit: 0, credit: 100.0 },
          ],
          { sourceType: 'manual' },
        ),
      ).rejects.toThrow('unbalanced');
    });
  });

  describe('postJournalEntry — account validation', () => {
    it('should reject when no account codes exist', async () => {
      await expect(
        service.postJournalEntry(
          [
            { accountCode: 'MISSING-1', debit: 100, credit: 0 },
            { accountCode: 'MISSING-2', debit: 0, credit: 100 },
          ],
          { sourceType: 'manual' },
        ),
      ).rejects.toThrow("'MISSING-1' does not exist");
    });

    it('should reject posting to a group account', async () => {
      await pg.db.insert(glAccounts).values({
        glAccountId: randomUUID(),
        accountCode: 'G-VAL-1000',
        name: 'Group Account',
        accountType: 'asset',
        isGroup: true,
        isActive: true,
        currencyCode: 'AUD',
      });
      await pg.db.insert(glAccounts).values({
        glAccountId: randomUUID(),
        accountCode: 'L-VAL-1000',
        name: 'Leaf Account',
        accountType: 'asset',
        isGroup: false,
        isActive: true,
        currencyCode: 'AUD',
      });

      await expect(
        service.postJournalEntry(
          [
            { accountCode: 'G-VAL-1000', debit: 100, credit: 0 },
            { accountCode: 'L-VAL-1000', debit: 0, credit: 100 },
          ],
          { sourceType: 'manual' },
        ),
      ).rejects.toThrow('group account');
    });
  });

  describe('postJournalEntry — success path', () => {
    it('should create entry and lines within a transaction', async () => {
      const arId = randomUUID();
      const revId = randomUUID();
      const invId = randomUUID();
      await pg.db.insert(glAccounts).values([
        {
          glAccountId: arId,
          accountCode: 'S-1100',
          isGroup: false,
          isActive: true,
          name: 'AR',
          accountType: 'asset',
          currencyCode: 'AUD',
        },
        {
          glAccountId: revId,
          accountCode: 'S-4100',
          isGroup: false,
          isActive: true,
          name: 'Revenue',
          accountType: 'revenue',
          currencyCode: 'AUD',
        },
      ]);

      const result = await service.postJournalEntry(
        [
          { accountCode: 'S-1100', debit: 500, credit: 0, memo: 'AR debit' },
          { accountCode: 'S-4100', debit: 0, credit: 500, memo: 'Rev credit' },
        ],
        {
          sourceType: 'sales_invoice',
          sourceId: invId,
          memo: 'Test',
          actor: 'admin',
        },
      );

      expect(result.journalEntryId).toBeDefined();

      const [entry] = await pg.db
        .select()
        .from(glJournalEntries)
        .where(eq(glJournalEntries.journalEntryId, result.journalEntryId));
      expect(entry).toMatchObject({
        sourceType: 'sales_invoice',
        sourceId: invId,
        memo: 'Test',
        createdBy: 'admin',
      });

      const lines = await pg.db
        .select()
        .from(glJournalLines)
        .where(eq(glJournalLines.journalEntryId, result.journalEntryId))
        .orderBy(glJournalLines.debit);
      expect(lines).toHaveLength(2);

      const debitLine = lines.find((l) => parseFloat(l.debit) === 500);
      const creditLine = lines.find((l) => parseFloat(l.credit) === 500);

      expect(debitLine).toMatchObject({
        glAccountId: arId,
        memo: 'AR debit',
      });
      expect(creditLine).toMatchObject({
        glAccountId: revId,
        memo: 'Rev credit',
      });
    });

    it('should increment sequence when entries already exist today', async () => {
      const today = new Date().toISOString().slice(0, 10);
      const todayStripped = today.replace(/-/g, '');

      await pg.db.insert(glAccounts).values([
        {
          accountCode: 'SEQ-1100',
          name: 'AR',
          accountType: 'asset',
          isGroup: false,
          isActive: true,
          currencyCode: 'AUD',
        },
        {
          accountCode: 'SEQ-4100',
          name: 'Rev',
          accountType: 'revenue',
          isGroup: false,
          isActive: true,
          currencyCode: 'AUD',
        },
      ]);

      await pg.db.insert(glJournalEntries).values({
        entryNumber: `JE-${todayStripped}-0003`,
        entryDate: today,
        sourceType: 'manual',
      });

      const result = await service.postJournalEntry(
        [
          { accountCode: 'SEQ-1100', debit: 100, credit: 0 },
          { accountCode: 'SEQ-4100', debit: 0, credit: 100 },
        ],
        { sourceType: 'manual' },
      );

      const [entry] = await pg.db
        .select()
        .from(glJournalEntries)
        .where(eq(glJournalEntries.journalEntryId, result.journalEntryId));
      expect(entry.entryNumber).toBe(`JE-${todayStripped}-0004`);
    });
  });

  describe('getChartOfAccounts (tree builder)', () => {
    it('should build nested tree from flat accounts', async () => {
      const a1 = randomUUID();
      const a2 = randomUUID();
      const a3 = randomUUID();
      const a4 = randomUUID();
      const a5 = randomUUID();

      await pg.db.insert(glAccounts).values([
        {
          glAccountId: a1,
          accountCode: 'T-1000',
          name: 'Assets Tree',
          parentAccountId: null,
          isGroup: true,
          accountType: 'asset',
          currencyCode: 'AUD',
        },
        {
          glAccountId: a2,
          accountCode: 'T-1100',
          name: 'AR Tree',
          parentAccountId: a1,
          isGroup: false,
          accountType: 'asset',
          currencyCode: 'AUD',
        },
        {
          glAccountId: a3,
          accountCode: 'T-1200',
          name: 'GST Tree',
          parentAccountId: a1,
          isGroup: false,
          accountType: 'asset',
          currencyCode: 'AUD',
        },
        {
          glAccountId: a4,
          accountCode: 'T-2000',
          name: 'Liabilities Tree',
          parentAccountId: null,
          isGroup: true,
          accountType: 'liability',
          currencyCode: 'AUD',
        },
        {
          glAccountId: a5,
          accountCode: 'T-2100',
          name: 'AP Tree',
          parentAccountId: a4,
          isGroup: false,
          accountType: 'liability',
          currencyCode: 'AUD',
        },
      ]);

      const tree = await service.getChartOfAccounts();

      expect(tree.length).toBeGreaterThanOrEqual(2);
      expect(tree.find((t) => t.name === 'Assets Tree')?.children).toHaveLength(
        2,
      );
      expect(
        tree.find((t) => t.name === 'Liabilities Tree')?.children,
      ).toHaveLength(1);
    });
  });

  describe('Trial Balance & General Ledger', () => {
    it('should return trial balance with correct balances', async () => {
      const [acct] = await pg.db
        .insert(glAccounts)
        .values({
          accountCode: 'TB-1100',
          name: 'AR TB',
          accountType: 'asset',
          isGroup: false,
          isActive: true,
          currencyCode: 'AUD',
        })
        .returning();

      const [entry] = await pg.db
        .insert(glJournalEntries)
        .values({
          entryNumber: 'JE-TB-001',
          entryDate: new Date().toISOString(),
          sourceType: 'manual',
        })
        .returning();

      await pg.db.insert(glJournalLines).values({
        journalEntryId: entry.journalEntryId,
        glAccountId: acct.glAccountId,
        debit: '500',
        credit: '200',
      });

      const tb = await service.getTrialBalance();
      const row = tb.find(
        (r) => (r as Record<string, unknown>).account_code === 'TB-1100',
      ) as Record<string, unknown>;
      expect(row).toBeDefined();
      expect(parseFloat(row.total_debit as string)).toBe(500);
      expect(parseFloat(row.total_credit as string)).toBe(200);
      expect(parseFloat(row.balance as string)).toBe(300);
    });
  });

  describe('Dimension Resolution', () => {
    it('should resolve missing dimensions from system defaults (code 00)', async () => {
      const ccId = randomUUID();
      const actId = randomUUID();

      await pg.db
        .insert(costCenters)
        .values({
          costCenterId: ccId,
          code: '00',
          name: 'Default CC',
          isSystem: true,
          isActive: true,
        })
        .onConflictDoUpdate({
          target: costCenters.code,
          set: { costCenterId: ccId },
        });

      await pg.db
        .insert(activities)
        .values({
          activityId: actId,
          code: '00',
          name: 'Default Activity',
          isSystem: true,
          isActive: true,
        })
        .onConflictDoUpdate({
          target: activities.code,
          set: { activityId: actId },
        });

      const [acct] = await pg.db
        .insert(glAccounts)
        .values({
          accountCode: 'DIM-1000',
          name: 'Test Dim',
          accountType: 'asset',
          isGroup: false,
          isActive: true,
          currencyCode: 'AUD',
        })
        .returning();

      const result = await service.postJournalEntry(
        [
          { accountCode: 'DIM-1000', debit: 100, credit: 0 },
          { accountCode: 'DIM-1000', debit: 0, credit: 100 },
        ],
        { sourceType: 'manual', actor: 'test' },
      );

      const lines = await pg.db
        .select()
        .from(glJournalLines)
        .where(eq(glJournalLines.journalEntryId, result.journalEntryId));
      expect(lines[0].costCenterId).toBe(ccId);
      expect(lines[0].activityId).toBe(actId);
    });
  });
});
