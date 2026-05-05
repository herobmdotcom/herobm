import { Test, TestingModule } from '@nestjs/testing';
import { ProductsService } from './products.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { NotFoundException } from '@nestjs/common';
import { createMemoryDb } from '../../test/utils/memory-db';
import { products, productEvents, uomDictionary } from '../drizzle/modbm-core-schema';
import { PgliteDatabase } from 'drizzle-orm/pglite';
import { eq } from 'drizzle-orm';

describe('ProductsService', () => {
  let service: ProductsService;
  let db: PgliteDatabase<any>;

  beforeEach(async () => {
    const mem = await createMemoryDb({ skipSeeds: true });
    db = mem.db;

    // Seed required UOM
    await db.insert(uomDictionary).values({
      uomCode: 'EA',
      description: 'Each',
    }).onConflictDoNothing();

    const module: TestingModule = await Test.createTestingModule({
      providers: [ProductsService, { provide: DRIZZLE, useValue: db }],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  describe('findAll', () => {
    beforeEach(async () => {
      await db.insert(products).values([
        {
          productId: '11111111-1111-1111-1111-111111111111',
          productNumber: 'BOLT-M8',
          name: 'M8 Hex Bolt',
          stateCode: 'active',
          baseUom: 'EA',
        },
        {
          productId: '22222222-2222-2222-2222-222222222222',
          productNumber: 'NUT-M8',
          name: 'M8 Hex Nut',
          stateCode: 'active',
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
      await db.insert(products).values({
        productId: targetId,
        productNumber: 'BOLT-M8',
        name: 'M8 Hex Bolt',
        stateCode: 'active',
        baseUom: 'EA',
      });

      await db.insert(productEvents).values({
        productId: targetId,
        eventType: 'created',
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
