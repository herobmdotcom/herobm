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
  glFiscalPeriods,
  glSettings,
  costCenters,
  activities,
  financialEvents,
  outbox,
} from '@herobm/db-schema';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

describe('GL Fiscal Periods & Period Governance', () => {
  const pg = setupPgliteSuite({ skipSeeds: true });
  let service: GlService;

  beforeEach(async () => {
    await pg.db.delete(outbox);
    await pg.db.delete(financialEvents);
    await pg.db.delete(glFiscalPeriods);
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
          useValue: { register: jest.fn() },
        },
        { provide: DRIZZLE, useValue: pg.db },
        {
          provide: AppConfigService,
          useValue: {
            homeCurrency: () => 'EUR',
            inventoryAccountingMode: () => 'perpetual',
          },
        },
      ],
    }).compile();

    service = module.get<GlService>(GlService);

    // Setup base settings
    await pg.db.insert(costCenters).values({
      costCenterId: randomUUID(),
      code: '00',
      name: 'Default Cost Center',
      isSystem: true,
      isActive: true,
    });
    await pg.db.insert(activities).values({
      activityId: randomUUID(),
      code: '00',
      name: 'Default Activity',
      isSystem: true,
      isActive: true,
    });
    await pg.db.insert(glSettings).values({
      fiscalYearStartMonth: 1,
      bankMatchDateToleranceDays: 3,
      baseCurrency: 'EUR',
      revenueRoutingPrecedence: 'product_first',
      expenseRoutingPrecedence: 'product_first',
    });
  });

  describe('generateFiscalYearPeriods', () => {
    it('generates 12 monthly periods for a calendar fiscal year and emits events', async () => {
      const periods = await service.generateFiscalYearPeriods(2026, 'admin');

      expect(periods).toHaveLength(12);
      expect(periods[0].periodName).toBe('2026-01');
      expect(periods[0].startDate).toBe('2026-01-01');
      expect(periods[0].endDate).toBe('2026-01-31');
      expect(periods[0].status).toBe('open');
      expect(periods[0].events).toBeDefined();
      expect(periods[0].events?.length).toBeGreaterThan(0);

      expect(periods[11].periodName).toBe('2026-12');
      expect(periods[11].startDate).toBe('2026-12-01');
      expect(periods[11].endDate).toBe('2026-12-31');
      expect(periods[11].status).toBe('open');

      // Verify audit events recorded in financialEvents
      const auditRows = await pg.db.select().from(financialEvents);
      expect(auditRows).toHaveLength(12);
      expect(auditRows[0].entityType).toBe('fiscal_period');
      expect(auditRows[0].eventType).toBe('created');
      expect(auditRows[0].actor).toBe('admin');

      // Verify integration outbox rows created
      const outboxRows = await pg.db.select().from(outbox);
      expect(outboxRows).toHaveLength(12);
      expect(outboxRows[0].eventType).toBe('fiscal_period.created');
    });

    it('idempotently avoids duplicating existing periods', async () => {
      await service.generateFiscalYearPeriods(2026, 'admin');
      const secondRun = await service.generateFiscalYearPeriods(2026, 'admin');
      expect(secondRun).toHaveLength(12);
    });
  });

  describe('updatePeriodStatus', () => {
    it('transitions period between open, soft_locked, and hard_closed and emits events', async () => {
      const [period] = await service.generateFiscalYearPeriods(2026, 'admin');

      // Soft lock
      const locked = await service.updatePeriodStatus(
        period.periodId,
        'soft_locked',
        'auditor',
        'Audit in progress',
      );
      expect(locked.status).toBe('soft_locked');
      expect(locked.lockedBy).toBe('auditor');
      expect(locked.lockedAt).toBeDefined();

      // Hard close
      const closed = await service.updatePeriodStatus(
        period.periodId,
        'hard_closed',
        'controller',
        'Final close completed',
      );
      expect(closed.status).toBe('hard_closed');
      expect(closed.closedBy).toBe('controller');
      expect(closed.closedAt).toBeDefined();

      // Re-open
      const reopened = await service.updatePeriodStatus(
        period.periodId,
        'open',
        'admin',
      );
      expect(reopened.status).toBe('open');
      expect(reopened.lockedBy).toBeNull();
      expect(reopened.closedBy).toBeNull();

      // Verify timeline events retrieved through getFiscalPeriods
      const periods = await service.getFiscalPeriods({ fiscalYear: 2026 });
      const updatedPeriod = periods.find(
        (p) => p.periodId === period.periodId,
      )!;
      expect(updatedPeriod.events).toBeDefined();
      // Should have 1 created + 3 status_changed events = 4 events
      expect(updatedPeriod.events?.length).toBe(4);

      // Verify outbox has status_changed events
      const outboxRows = await pg.db
        .select()
        .from(outbox)
        .where(eq(outbox.entityId, period.periodId));
      expect(
        outboxRows.filter(
          (r) => r.eventType === 'fiscal_period.status_changed',
        ),
      ).toHaveLength(3);
    });

    it('throws NotFoundException for non-existent periodId', async () => {
      await expect(
        service.updatePeriodStatus(randomUUID(), 'hard_closed', 'admin'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Period Enforcement on postJournalEntry', () => {
    let account1200Id: string;
    let account2000Id: string;

    beforeEach(async () => {
      const [acct1] = await pg.db
        .insert(glAccounts)
        .values({
          accountCode: '1200',
          name: 'Accounts Receivable',
          accountType: 'asset',
          isGroup: false,
          isSystem: true,
          isBankAccount: false,
          currencyCode: 'EUR',
          isActive: true,
        })
        .returning();

      const [acct2] = await pg.db
        .insert(glAccounts)
        .values({
          accountCode: '2000',
          name: 'Accounts Payable',
          accountType: 'liability',
          isGroup: false,
          isSystem: true,
          isBankAccount: false,
          currencyCode: 'EUR',
          isActive: true,
        })
        .returning();

      account1200Id = acct1.glAccountId;
      account2000Id = acct2.glAccountId;

      await service.generateFiscalYearPeriods(2026, 'admin');
    });

    it('allows posting journal entries in open periods', async () => {
      const entry = await service.postJournalEntry(
        [
          { accountId: account1200Id, debit: 100, credit: 0 },
          { accountId: account2000Id, debit: 0, credit: 100 },
        ],
        {
          sourceType: 'manual',
          entryDate: '2026-03-15',
          memo: 'Valid open period posting',
        },
      );

      expect(entry).toBeDefined();
      expect(entry.entryNumber).toBeDefined();
    });

    it('rejects posting journal entries in soft-locked periods', async () => {
      const periods = await service.getFiscalPeriods({ fiscalYear: 2026 });
      const marchPeriod = periods.find((p) => p.periodName === '2026-03')!;

      await service.updatePeriodStatus(
        marchPeriod.periodId,
        'soft_locked',
        'admin',
      );

      await expect(
        service.postJournalEntry(
          [
            { accountId: account1200Id, debit: 100, credit: 0 },
            { accountId: account2000Id, debit: 0, credit: 100 },
          ],
          {
            sourceType: 'manual',
            entryDate: '2026-03-15',
            memo: 'Should fail due to soft lock',
          },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects posting journal entries in hard-closed periods', async () => {
      const periods = await service.getFiscalPeriods({ fiscalYear: 2026 });
      const marchPeriod = periods.find((p) => p.periodName === '2026-03')!;

      await service.updatePeriodStatus(
        marchPeriod.periodId,
        'hard_closed',
        'admin',
      );

      await expect(
        service.postJournalEntry(
          [
            { accountId: account1200Id, debit: 100, credit: 0 },
            { accountId: account2000Id, debit: 0, credit: 100 },
          ],
          {
            sourceType: 'manual',
            entryDate: '2026-03-20',
            memo: 'Should fail due to hard close',
          },
        ),
      ).rejects.toThrow(
        /Cannot post to hard-closed accounting period '2026-03'/,
      );
    });
  });
});
