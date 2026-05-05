import { Test, TestingModule } from '@nestjs/testing';
import { AccountsService } from './accounts.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { NotFoundException } from '@nestjs/common';
import { setupPgliteSuite } from '../test-utils/pglite-suite';
import {
  accounts,
  accountEvents,
  accountGroups,
  taxCategories,
} from '../drizzle/modbm-core-schema';
import { sql } from 'drizzle-orm';

describe('AccountsService', () => {
  const pg = setupPgliteSuite();
  let service: AccountsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AccountsService, { provide: DRIZZLE, useValue: db }],
    }).compile();

    service = module.get<AccountsService>(AccountsService);

    // Clean tables
    await pg.db.delete(accountEvents);
    await pg.db.delete(accounts);
    await pg.db.delete(accountGroups);
    await pg.db.delete(taxCategories);
  });

  describe('findAll', () => {
    it('should return paginated accounts', async () => {
      await pg.db.insert(accounts).values([
        {
          name: 'Account A',
          accountNumber: 'A1',
          currencyCode: 'USD',
        },
        {
          name: 'Account B',
          accountNumber: 'B1',
          currencyCode: 'USD',
        },
      ]);

      const result = await service.findAll();
      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
    });

    it('should apply search filter (ilike)', async () => {
      await pg.db.insert(accounts).values([
        {
          name: 'Acme Corp',
          accountNumber: 'ACME',
          currencyCode: 'USD',
        },
        {
          name: 'Other Inc',
          accountNumber: 'OTHER',
          currencyCode: 'USD',
        },
      ]);

      const result = await service.findAll({ q: 'acme' });
      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe('Acme Corp');
    });

    it('should join with account groups and tax categories', async () => {
      const [tc] = await db
        .insert(taxCategories)
        .values({
          code: 'GST',
          title: 'GST',
          type: 'tax_applies',
        })
        .returning();

      const [ag] = await pg.db
        .insert(accountGroups)
        .values({
          name: 'VIP',
          groupCode: 'VIP01',
        })
        .returning();

      await pg.db.insert(accounts).values({
        name: 'VIP Client',
        accountNumber: 'VIP-001',
        currencyCode: 'AUD',
        accountGroupId: ag.accountGroupId,
        taxCategoryId: tc.taxCategoryId,
      });

      const result = await service.findAll();
      expect(result.data[0]).toMatchObject({
        accountGroupName: 'VIP',
        gstCategoryName: 'GST',
      });
    });

    it('should exclude archived accounts by default', async () => {
      await pg.db.insert(accounts).values([
        {
          name: 'Active',
          accountNumber: 'ACT',
          currencyCode: 'USD',
          stateCode: 'active',
        },
        {
          name: 'Archived',
          accountNumber: 'ARC',
          currencyCode: 'USD',
          stateCode: 'archived',
        },
      ]);

      const result = await service.findAll();
      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe('Active');

      const resultWithArchived = await service.findAll({
        includeArchived: true,
      });
      expect(resultWithArchived.data).toHaveLength(2);
    });
  });

  describe('findOne', () => {
    it('should return account by UUID with its events', async () => {
      const [acc] = await pg.db
        .insert(accounts)
        .values({
          name: 'Main Account',
          accountNumber: 'MAIN',
          currencyCode: 'GBP',
        })
        .returning();

      await pg.db.insert(accountEvents).values({
        accountId: acc.accountId,
        eventType: 'created',
        actor: 'system',
      });

      const result = await service.findOne(acc.accountId);
      expect(result.name).toBe('Main Account');
      expect(result.events).toHaveLength(1);
      expect(result.events[0].eventType).toBe('created');
    });

    it('should return account by sourceId (legacy)', async () => {
      await pg.db.insert(accounts).values({
        name: 'Legacy Account',
        accountNumber: 'LEG1',
        currencyCode: 'USD',
        sourceId: 'ABM-999',
      });

      const result = await service.findOne('ABM-999');
      expect(result.name).toBe('Legacy Account');
    });

    it('should throw NotFoundException if not found', async () => {
      await expect(service.findOne('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
