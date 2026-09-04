import { Test, TestingModule } from '@nestjs/testing';
import { ProductsWriteService } from './products-write.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { setupPgliteSuite } from '../test-utils/pglite-suite';
import {
  products,
  masterDataEvents,
  uomDictionary,
  productUoms,
  productSuppliers,
  productComponents,
  suppliers,
  actors,
} from '@herobm/db-schema';
import { eq, sql, and } from 'drizzle-orm';
import { PRODUCT_STATE, SUPPLIER_STATE, ACTOR_STATE } from '@herobm/shared';
import { EventType, EntityType } from '../common/event-types';
import { StorageService } from '../common/storage/storage.service';
import { ProductCopyService } from './product-copy.service';

describe('ProductsWriteService', () => {
  const pg = setupPgliteSuite();
  let service: ProductsWriteService;

  beforeEach(async () => {
    // Seed required UOM once for the entire suite
    await pg.db
      .insert(uomDictionary)
      .values([
        { uomCode: 'EA', description: 'Each' },
        { uomCode: 'BOX', description: 'Box' },
      ])
      .onConflictDoNothing();
  });

  beforeEach(async () => {
    await pg.db.execute(
      sql`TRUNCATE herobm_core.master_data_events, herobm_core.products CASCADE`,
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsWriteService,
        ProductCopyService,
        { provide: DRIZZLE, useValue: pg.db },
        StorageService,
      ],
    }).compile();

    service = module.get<ProductsWriteService>(ProductsWriteService);
  });

  describe('create', () => {
    it('should create a product and insert an event', async () => {
      const dto = {
        productNumber: 'PROD-NEW-' + Math.random(),
        name: 'Test Product',
        productType: 'inventory' as const,
        baseUom: 'EA',
      };
      const result = await service.create(dto, 'admin');

      expect(result).toBeDefined();
      const events = await pg.db
        .select()
        .from(masterDataEvents)
        .where(
          and(
            eq(masterDataEvents.entityId, result.productId),
            eq(masterDataEvents.entityType, EntityType.PRODUCT),
          ),
        );
      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe(EventType.CREATED);
    });

    it('should allow creation of a stock kit (productType inventory, structureType kit)', async () => {
      const dto = {
        productNumber: 'PROD-STOCK-KIT-' + Math.random(),
        name: 'Stock Kit Product',
        productType: 'inventory' as const,
        structureType: 'kit' as const,
        baseUom: 'EA',
      };
      const result = await service.create(dto, 'admin');

      expect(result).toBeDefined();
      expect(result.productType).toBe('inventory');
      expect(result.structureType).toBe('kit');
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
          productType: 'inventory',
          source: 'app',
          structureType: 'standard',
          createdBy: 'system',
        })
        .returning();
      productId = p.productId;
    });

    it('should update product and write standard update event', async () => {
      await service.update(productId, { name: 'New Name' }, 'admin');
      const events = await pg.db
        .select()
        .from(masterDataEvents)
        .where(
          and(
            eq(masterDataEvents.entityId, productId),
            eq(masterDataEvents.entityType, EntityType.PRODUCT),
          ),
        );
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
        .from(masterDataEvents)
        .where(
          and(
            eq(masterDataEvents.entityId, productId),
            eq(masterDataEvents.entityType, EntityType.PRODUCT),
          ),
        );
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
          productType: 'inventory',
          baseUom: 'EA',
          source: 'app',
          structureType: 'standard',
          createdBy: 'system',
        })
        .returning();
      productId = p.productId;
    });

    it('should archive an active product and create an event', async () => {
      const result = await service.archive(productId, 'admin');
      expect(result.stateCode).toBe(PRODUCT_STATE.ARCHIVED);
      const events = await pg.db
        .select()
        .from(masterDataEvents)
        .where(
          and(
            eq(masterDataEvents.entityId, productId),
            eq(masterDataEvents.entityType, EntityType.PRODUCT),
          ),
        );
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
          productType: 'inventory',
          baseUom: 'EA',
          source: 'app',
          structureType: 'standard',
          createdBy: 'system',
        })
        .returning();
      productId = p.productId;
    });

    it('should unarchive to previous state based on last event', async () => {
      await pg.db.insert(masterDataEvents).values({
        entityId: productId,
        entityType: EntityType.PRODUCT,
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

  describe('copy', () => {
    let sourceProductId: string;

    beforeEach(async () => {
      const [p] = await pg.db
        .insert(products)
        .values({
          productNumber: 'PROD-BASE',
          name: 'Base Product',
          stateCode: PRODUCT_STATE.ACTIVE,
          productType: 'inventory',
          structureType: 'standard',
          baseUom: 'EA',
          listPrice: '100.00',
          standardCost: '50.00',
          tradePrice: '80.00',
          priceLevel3: '75.00',
          priceLevel4: '70.00',
          barcode: '1234567890',
          weight: '1.2500',
          notes: 'Source product notes',
          source: 'app',
          createdBy: 'admin',
        })
        .returning();
      sourceProductId = p.productId;
    });

    it('should copy standard product with default SKU and name', async () => {
      const result = await service.copy(sourceProductId, {}, 'admin');

      expect(result).toBeDefined();
      expect(result.productId).not.toBe(sourceProductId);
      expect(result.productNumber).toBe('PROD-BASE-COPY');
      expect(result.name).toBe('Base Product (Copy)');
      expect(result.listPrice).toBe('100.00');
      expect(result.standardCost).toBe('50.00');
      expect(result.tradePrice).toBe('80.00');
      expect(result.barcode).toBeNull();
      expect(result.stateCode).toBe(PRODUCT_STATE.ACTIVE);
      expect(result.notes).toBe('Source product notes');

      // Verify audit event
      const events = await pg.db
        .select()
        .from(masterDataEvents)
        .where(
          and(
            eq(masterDataEvents.entityId, result.productId),
            eq(masterDataEvents.entityType, EntityType.PRODUCT),
          ),
        );
      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe(EventType.CREATED);
    });

    it('should copy with custom SKU and custom name', async () => {
      const result = await service.copy(
        sourceProductId,
        { productNumber: 'PROD-CUSTOM', name: 'Custom Cloned Name' },
        'admin',
      );

      expect(result.productNumber).toBe('PROD-CUSTOM');
      expect(result.name).toBe('Custom Cloned Name');
    });

    it('should auto-increment SKU suffix on collision', async () => {
      // First copy creates PROD-BASE-COPY
      const copy1 = await service.copy(sourceProductId, {}, 'admin');
      expect(copy1.productNumber).toBe('PROD-BASE-COPY');

      // Second copy should resolve collision to PROD-BASE-COPY-2
      const copy2 = await service.copy(sourceProductId, {}, 'admin');
      expect(copy2.productNumber).toBe('PROD-BASE-COPY-2');

      // Third copy should resolve to PROD-BASE-COPY-3
      const copy3 = await service.copy(sourceProductId, {}, 'admin');
      expect(copy3.productNumber).toBe('PROD-BASE-COPY-3');
    });

    it('should throw BadRequestException if custom SKU already exists', async () => {
      await expect(
        service.copy(sourceProductId, { productNumber: 'PROD-BASE' }, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if source product does not exist', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      await expect(service.copy(nonExistentId, {}, 'admin')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should copy UOM conversions and re-link default UOMs', async () => {
      const [uom] = await pg.db
        .insert(productUoms)
        .values({
          productId: sourceProductId,
          uomCode: 'BOX',
          ratio: '12.0000',
        })
        .returning();

      await pg.db
        .update(products)
        .set({
          defaultSalesUomId: uom.productUomId,
          defaultPurchaseUomId: uom.productUomId,
        })
        .where(eq(products.productId, sourceProductId));

      const copyResult = await service.copy(sourceProductId, {}, 'admin');

      // Check new UOM was created
      const copiedUoms = await pg.db
        .select()
        .from(productUoms)
        .where(eq(productUoms.productId, copyResult.productId));

      expect(copiedUoms).toHaveLength(1);
      expect(copiedUoms[0].uomCode).toBe('BOX');
      expect(copiedUoms[0].ratio).toBe('12.0000');
      expect(copiedUoms[0].productUomId).not.toBe(uom.productUomId);

      // Check default UoM pointers were updated to the new UOM
      expect(copyResult.defaultSalesUomId).toBe(copiedUoms[0].productUomId);
      expect(copyResult.defaultPurchaseUomId).toBe(copiedUoms[0].productUomId);
    });

    it('should copy active suppliers', async () => {
      const actorId = '0e3c4e85-d865-4f40-8abf-c4e89e47261d';
      const vendorId = '7d2e99f5-46f9-4d6b-bd5d-31849cf2a561';

      await pg.db.insert(actors).values({
        actorId,
        name: 'Supplier Co',
        stateCode: ACTOR_STATE.ACTIVE,
        headquartersAddressLine1: 'AU',
        isTaxRegistered: false,
      });

      await pg.db.insert(suppliers).values({
        vendorId,
        actorId,
        vendorNumber: 'V001',
        currencyCode: 'EUR',
        stateCode: SUPPLIER_STATE.ACTIVE,
        source: 'app',
        isPurchasingBlocked: false,
        createdBy: 'system',
      });

      await pg.db.insert(productSuppliers).values({
        productId: sourceProductId,
        vendorId,
        supplierPartNumber: 'SUP-PART-1',
        costPrice: '45.00',
        isPreferred: true,
        stateCode: SUPPLIER_STATE.ACTIVE,
        source: 'app',
        createdBy: 'system',
      });

      const copyResult = await service.copy(sourceProductId, {}, 'admin');

      const copiedSuppliers = await pg.db
        .select()
        .from(productSuppliers)
        .where(eq(productSuppliers.productId, copyResult.productId));

      expect(copiedSuppliers).toHaveLength(1);
      expect(copiedSuppliers[0].vendorId).toBe(vendorId);
      expect(copiedSuppliers[0].supplierPartNumber).toBe('SUP-PART-1');
      expect(copiedSuppliers[0].costPrice).toBe('45.00');
      expect(copiedSuppliers[0].isPreferred).toBe(true);
    });

    it('should copy kit components for kit products', async () => {
      // Create child product
      const [child] = await pg.db
        .insert(products)
        .values({
          productNumber: 'PROD-CHILD',
          name: 'Child Component',
          stateCode: PRODUCT_STATE.ACTIVE,
          productType: 'inventory',
          structureType: 'standard',
          baseUom: 'EA',
          source: 'app',
          createdBy: 'admin',
        })
        .returning();

      // Create kit parent product
      const [kitParent] = await pg.db
        .insert(products)
        .values({
          productNumber: 'PROD-KIT',
          name: 'Kit Product',
          stateCode: PRODUCT_STATE.ACTIVE,
          productType: 'non-stock',
          structureType: 'kit',
          baseUom: 'EA',
          source: 'app',
          createdBy: 'admin',
        })
        .returning();

      await pg.db.insert(productComponents).values({
        parentProductId: kitParent.productId,
        childProductId: child.productId,
        parentQuantity: '1.0000',
        quantity: '3.0000',
        sequenceNumber: 1,
        fractionalBehavior: 'allow_fractional',
      });

      const copyResult = await service.copy(kitParent.productId, {}, 'admin');

      expect(copyResult.structureType).toBe('kit');

      const copiedComponents = await pg.db
        .select()
        .from(productComponents)
        .where(eq(productComponents.parentProductId, copyResult.productId));

      expect(copiedComponents).toHaveLength(1);
      expect(copiedComponents[0].childProductId).toBe(child.productId);
      expect(copiedComponents[0].quantity).toBe('3.0000');
    });
  });
});
