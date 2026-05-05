import { Test, TestingModule } from '@nestjs/testing';
import { ProductsWriteService } from './products-write.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { createMemoryDb } from '../../test/utils/memory-db';
import { products, productEvents, uomDictionary } from '../drizzle/modbm-core-schema';
import { PgliteDatabase } from 'drizzle-orm/pglite';
import { eq } from 'drizzle-orm';

describe('ProductsWriteService', () => {
  let service: ProductsWriteService;
  let db: PgliteDatabase<any>;

  beforeEach(async () => {
    const mem = await createMemoryDb({ skipSeeds: true });
    db = mem.db;

    // Seed required UOM for foreign key constraints
    await db.insert(uomDictionary).values({
      uomCode: 'EA',
      description: 'Each',
    }).onConflictDoNothing();

    const module: TestingModule = await Test.createTestingModule({
      providers: [ProductsWriteService, { provide: DRIZZLE, useValue: db }],
    }).compile();

    service = module.get<ProductsWriteService>(ProductsWriteService);
  });

  describe('create', () => {
    it('should create a product and insert an event', async () => {
      const dto = {
        productNumber: 'PROD-NEW-' + Math.random(),
        name: 'Test Product',
      };
      const result = await service.create(dto, 'admin');

      expect(result).toBeDefined();
      const events = await db.select().from(productEvents).where(eq(productEvents.productId, result.productId));
      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe('created');
    });
  });

  describe('update', () => {
    let productId: string;

    beforeEach(async () => {
      const [p] = await db.insert(products).values({
        productNumber: 'PROD-UP-' + Math.random(),
        name: 'Old Name',
        stateCode: 'active',
        baseUom: 'EA',
      }).returning();
      productId = p.productId;
    });

    it('should update product and write standard update event', async () => {
      await service.update(productId, { name: 'New Name' }, 'admin');
      const events = await db.select().from(productEvents).where(eq(productEvents.productId, productId));
      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe('updated');
    });

    it('should write specialized status_changed event if only stateCode is updated', async () => {
      await service.update(productId, { stateCode: 'archived' }, 'admin');
      const events = await db.select().from(productEvents).where(eq(productEvents.productId, productId));
      expect(events[0].eventType).toBe('status_changed');
    });
  });

  describe('archive', () => {
    let productId: string;

    beforeEach(async () => {
      const [p] = await db.insert(products).values({
        productNumber: 'PROD-ARC-' + Math.random(),
        name: 'To Archive',
        stateCode: 'active',
        baseUom: 'EA',
      }).returning();
      productId = p.productId;
    });

    it('should archive an active product and create an event', async () => {
      const result = await service.archive(productId, 'admin');
      expect(result.stateCode).toBe('archived');
      const events = await db.select().from(productEvents).where(eq(productEvents.productId, productId));
      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe('archived');
    });
  });

  describe('unarchive', () => {
    let productId: string;

    beforeEach(async () => {
      const [p] = await db.insert(products).values({
        productNumber: 'PROD-UNARC-' + Math.random(),
        name: 'To Unarchive',
        stateCode: 'archived',
        baseUom: 'EA',
      }).returning();
      productId = p.productId;
    });

    it('should unarchive to previous state based on last event', async () => {
      await db.insert(productEvents).values({
        productId,
        eventType: 'archived',
        payload: { from: 'draft', to: 'archived' },
        actor: 'admin',
      });

      const result = await service.unarchive(productId, 'admin');
      expect(result.stateCode).toBe('draft');
    });

    it('should unarchive to active if no previous state is found', async () => {
      const result = await service.unarchive(productId, 'admin');
      expect(result.stateCode).toBe('active');
    });
  });
});
