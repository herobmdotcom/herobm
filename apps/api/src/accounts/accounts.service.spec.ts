import { Test, TestingModule } from '@nestjs/testing';
import { AccountsService } from './accounts.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { NotFoundException } from '@nestjs/common';
import { createMemoryDb } from '../../test/utils/memory-db';
import { PgliteDatabase } from 'drizzle-orm/pglite';
import {
  accounts,
  accountEvents,
  accountGroups,
  taxCategories,
} from '../drizzle/modbm-core-schema';

describe('AccountsService', () => {
  let service: AccountsService;
  let db: PgliteDatabase<any>;
  let client: any;

  beforeAll(async () => {
    const mem = await createMemoryDb({ skipSeeds: true });
    db = mem.db;
    client = mem.client;
  });

  afterAll(async () => {
    await client.close();
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AccountsService, { provide: DRIZZLE, useValue: db }],
    }).compile();

    service = module.get<AccountsService>(AccountsService);

    // Clean tables
    await db.delete(accountEvents);
    await db.delete(accounts);
    await db.delete(accountGroups);
    await db.delete(taxCategories);
  });

  describe('findAll', () => {
    it('should return paginated accounts', async () => {
      await db.insert(accounts).values([
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
      await db.insert(accounts).values([
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

      const [ag] = await db
        .insert(accountGroups)
        .values({
          name: 'VIP',
          groupCode: 'VIP01',
        })
        .returning();

      await db.insert(accounts).values({
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
      await db.insert(accounts).values([
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

      const resultWithArchived = await service.findAll({ includeArchived: true });
      expect(resultWithArchived.data).toHaveLength(2);
    });
  });

  describe('findOne', () => {
    it('should return account by UUID with its events', async () => {
      const [acc] = await db
        .insert(accounts)
        .values({
          name: 'Main Account',
          accountNumber: 'MAIN',
          currencyCode: 'GBP',
        })
        .returning();

      await db.insert(accountEvents).values({
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
      await db.insert(accounts).values({
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
