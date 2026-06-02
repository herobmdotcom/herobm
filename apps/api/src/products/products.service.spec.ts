import { Test, TestingModule } from '@nestjs/testing';
import { ProductsService } from './products.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { NotFoundException } from '@nestjs/common';
import { setupPgliteSuite } from '../test-utils/pglite-suite';
import {
  products,
  masterDataEvents,
  uomDictionary,
} from '../drizzle/modbm-core-schema';
import { eq } from 'drizzle-orm';
import {
  PRODUCT_STATE,
  SALES_ORDER_STATE,
  CUSTOMER_STATE,
} from '@modbm/shared';
import { EventType, EntityType } from '../common/event-types';

describe('ProductsService', () => {
  const pg = setupPgliteSuite({ skipSeeds: true });
  let service: ProductsService;

  beforeEach(async () => {
    await pg.db.delete(masterDataEvents);
    await pg.db.delete(products);

    // Seed required UOM
    await pg.db
      .insert(uomDictionary)
      .values({
        uomCode: 'EA',
        description: 'Each',
      })
      .onConflictDoNothing();

    const module: TestingModule = await Test.createTestingModule({
      providers: [ProductsService, { provide: DRIZZLE, useValue: pg.db }],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  describe('findAll', () => {
    beforeEach(async () => {
      await pg.db.insert(products).values([
        {
          productId: '11111111-1111-1111-1111-111111111111',
          productNumber: 'BOLT-M8',
          name: 'M8 Hex Bolt',
          stateCode: PRODUCT_STATE.ACTIVE,
          baseUom: 'EA',
        },
        {
          productId: '22222222-2222-2222-2222-222222222222',
          productNumber: 'NUT-M8',
          name: 'M8 Hex Nut',
          stateCode: PRODUCT_STATE.ACTIVE,
          baseUom: 'EA',
        },
      ]);
    });

    it('should return paginated products with total count', async () => {
      const result = await service.findAll();
      expect(result).toHaveProperty('data');
      expect(result.data).toHaveLength(2);
      expect(result).toHaveProperty('page', 1);
      expect(result).toHaveProperty('total', 2);
    });

    it('should apply search filter when q is provided', async () => {
      const result = await service.findAll({ q: 'bolt' });
      expect(result.data).toHaveLength(1);
      expect(result.data[0].productNumber).toBe('BOLT-M8');
    });

    it('should cap limit at 100000', async () => {
      const result = await service.findAll({ limit: 200_000 });
      expect(result.limit).toBe(100_000);
    });
  });

  describe('findOne', () => {
    const targetId = '11111111-1111-1111-1111-111111111111';

    beforeEach(async () => {
      await pg.db.insert(products).values({
        productId: targetId,
        productNumber: 'BOLT-M8',
        name: 'M8 Hex Bolt',
        stateCode: PRODUCT_STATE.ACTIVE,
        baseUom: 'EA',
      });

      await pg.db.insert(masterDataEvents).values({
        entityId: targetId,
        entityType: EntityType.PRODUCT,
        eventType: EventType.CREATED,
        payload: { name: 'M8 Hex Bolt' },
        actor: 'admin',
      });
    });

    it('should return a single product with events', async () => {
      const result = await service.findOne(targetId);
      expect(result.productNumber).toBe('BOLT-M8');
      expect(result.events).toHaveLength(1);
      expect(result.events[0].eventType).toBe('created');
    });

    it('should throw NotFoundException for unknown ID', async () => {
      await expect(
        service.findOne('99999999-9999-9999-9999-999999999999'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
