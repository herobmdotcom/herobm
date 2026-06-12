import { Test, TestingModule } from '@nestjs/testing';
import { AccountsService } from './customers.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { NotFoundException } from '@nestjs/common';
import { setupPgliteSuite } from '../test-utils/pglite-suite';
import {
  customers,
  masterDataEvents,
  customerGroups,
  taxCategories,
} from '../drizzle/modbm-core-schema';
import { sql } from 'drizzle-orm';
import { CUSTOMER_STATE } from '@modbm/shared';

describe('AccountsService', () => {
  const pg = setupPgliteSuite();
  let service: AccountsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AccountsService, { provide: DRIZZLE, useValue: pg.db }],
    }).compile();

    service = module.get<AccountsService>(AccountsService);

    // Clean tables
    await pg.db.delete(masterDataEvents);
    await pg.db.delete(customers);
    await pg.db.delete(customerGroups);
    await pg.db.delete(taxCategories);
  });

  describe('findAll', () => {
    it('should return paginated customers', async () => {
      await pg.db.insert(customers).values([
        {
          name: 'Customer A',
          customerNumber: 'A1',
          currencyCode: 'USD',
          billingAddressCountry: 'AU',
        },
        {
          name: 'Customer B',
          customerNumber: 'B1',
          currencyCode: 'USD',
          billingAddressCountry: 'AU',
        },
      ]);

      const result = await service.findAll();
      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
    });

    it('should apply search filter (ilike)', async () => {
      await pg.db.insert(customers).values([
        {
          name: 'Acme Corp',
          customerNumber: 'ACME',
          currencyCode: 'USD',
          billingAddressCountry: 'AU',
        },
        {
          name: 'Other Inc',
          customerNumber: 'OTHER',
          currencyCode: 'USD',
          billingAddressCountry: 'AU',
        },
      ]);

      const result = await service.findAll({ q: 'acme' });
      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe('Acme Corp');
    });

    it('should join with customer groups and tax categories', async () => {
      const [tc] = await pg.db
        .insert(taxCategories)
        .values({
          code: 'GST',
          title: 'GST',
          type: 'tax_applies',
        })
        .returning();

      const [ag] = await pg.db
        .insert(customerGroups)
        .values({
          name: 'VIP',
          groupCode: 'VIP01',
        })
        .returning();

      await pg.db.insert(customers).values({
        name: 'VIP Client',
        customerNumber: 'VIP-001',
        currencyCode: 'AUD',
        billingAddressCountry: 'AU',
        customerGroupId: ag.customerGroupId,
        taxCategoryId: tc.taxCategoryId,
      });

      const result = await service.findAll();
      expect(result.data[0]).toMatchObject({
        customerGroupName: 'VIP',
        gstCategoryName: 'GST',
      });
    });

    it('should exclude archived customers by default', async () => {
      await pg.db.insert(customers).values([
        {
          name: 'Active',
          customerNumber: 'ACT',
          currencyCode: 'USD',
          billingAddressCountry: 'AU',
          stateCode: CUSTOMER_STATE.ACTIVE,
        },
        {
          name: 'Archived',
          customerNumber: 'ARC',
          currencyCode: 'USD',
          billingAddressCountry: 'AU',
          stateCode: CUSTOMER_STATE.ARCHIVED,
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
    it('should return customer by UUID with its events', async () => {
      const [acc] = await pg.db
        .insert(customers)
        .values({
          name: 'Main Customer',
          customerNumber: 'MAIN',
          currencyCode: 'GBP',
          billingAddressCountry: 'AU',
        })
        .returning();

      await pg.db.insert(masterDataEvents).values({
        entityType: 'customer',
        entityId: acc.customerId,
        eventType: 'created',
        payload: { created: true },
        actor: 'user',
      });

      const result = await service.findOne(acc.customerId);
      expect(result.name).toBe('Main Customer');
      expect(result.events).toHaveLength(1);
      expect(result.events[0].eventType).toBe('created');
    });

    it('should return customer by sourceId (legacy)', async () => {
      await pg.db.insert(customers).values({
        name: 'Legacy Customer',
        customerNumber: 'LEG1',
        currencyCode: 'USD',
        billingAddressCountry: 'AU',
        sourceId: 'ABM-999',
      });

      const result = await service.findOne('ABM-999');
      expect(result.name).toBe('Legacy Customer');
    });

    it('should throw NotFoundException if not found', async () => {
      await expect(service.findOne('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
