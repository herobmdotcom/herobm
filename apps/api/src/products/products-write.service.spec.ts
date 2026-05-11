import { Test, TestingModule } from '@nestjs/testing';
import { ProductsWriteService } from './products-write.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { setupPgliteSuite } from '../test-utils/pglite-suite';
import {
  products,
  productEvents,
  uomDictionary,
} from '../drizzle/modbm-core-schema';
import { eq, sql } from 'drizzle-orm';
import { PRODUCT_STATE } from '@modbm/shared';
import { EventType } from '../common/event-types';

describe('ProductsWriteService', () => {
  const pg = setupPgliteSuite();
  let service: ProductsWriteService;

  beforeEach(async () => {
    // Seed required UOM once for the entire suite
    await pg.db
      .insert(uomDictionary)
      .values({
        uomCode: 'EA',
        description: 'Each',
      })
      .onConflictDoNothing();
  });

  beforeEach(async () => {
    await pg.db.execute(
      sql`TRUNCATE modbm_core.product_events, modbm_core.products CASCADE`,
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [ProductsWriteService, { provide: DRIZZLE, useValue: pg.db }],
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
      const events = await pg.db
        .select()
        .from(productEvents)
        .where(eq(productEvents.productId, result.productId));
      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe(EventType.CREATED);
    });
  });

  describe('update', () => {
    let productId: string;

    beforeEach(async () => {
      const [p] = await pg.db
        .insert(products)
        .values({
          productNumber: 'PROD-UP-' + Math.random(),
          name: 'Old Name',
          stateCode: PRODUCT_STATE.ACTIVE,
          baseUom: 'EA',
        })
        .returning();
      productId = p.productId;
    });

    it('should update product and write standard update event', async () => {
      await service.update(productId, { name: 'New Name' }, 'admin');
      const events = await pg.db
        .select()
        .from(productEvents)
        .where(eq(productEvents.productId, productId));
      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe(EventType.UPDATED);
    });

    it('should write specialized status_changed event if only stateCode is updated', async () => {
      await service.update(
        productId,
        { stateCode: PRODUCT_STATE.ARCHIVED },
        'admin',
      );
      const events = await pg.db
        .select()
        .from(productEvents)
        .where(eq(productEvents.productId, productId));
      expect(events[0].eventType).toBe(EventType.STATUS_CHANGED);
    });
  });

  describe('archive', () => {
    let productId: string;

    beforeEach(async () => {
      const [p] = await pg.db
        .insert(products)
        .values({
          productNumber: 'PROD-ARC-' + Math.random(),
          name: 'To Archive',
          stateCode: PRODUCT_STATE.ACTIVE,
          baseUom: 'EA',
        })
        .returning();
      productId = p.productId;
    });

    it('should archive an active product and create an event', async () => {
      const result = await service.archive(productId, 'admin');
      expect(result.stateCode).toBe(PRODUCT_STATE.ARCHIVED);
      const events = await pg.db
        .select()
        .from(productEvents)
        .where(eq(productEvents.productId, productId));
      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe(EventType.ARCHIVED);
    });
  });

  describe('unarchive', () => {
    let productId: string;

    beforeEach(async () => {
      const [p] = await pg.db
        .insert(products)
        .values({
          productNumber: 'PROD-UNARC-' + Math.random(),
          name: 'To Unarchive',
          stateCode: PRODUCT_STATE.ARCHIVED,
          baseUom: 'EA',
        })
        .returning();
      productId = p.productId;
    });

    it('should unarchive to previous state based on last event', async () => {
      await pg.db.insert(productEvents).values({
        productId,
        eventType: EventType.ARCHIVED,
        payload: { from: PRODUCT_STATE.DRAFT, to: PRODUCT_STATE.ARCHIVED },
        actor: 'admin',
      });

      const result = await service.unarchive(productId, 'admin');
      expect(result.stateCode).toBe(PRODUCT_STATE.DRAFT);
    });

    it('should unarchive to active if no previous state is found', async () => {
      const result = await service.unarchive(productId, 'admin');
      expect(result.stateCode).toBe(PRODUCT_STATE.ACTIVE);
    });
  });
});
