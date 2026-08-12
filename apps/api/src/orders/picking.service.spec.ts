import { AppConfigService } from '../settings/app-config.service';
import { Test, TestingModule } from '@nestjs/testing';
import { PickingService } from './picking.service';
import { PickingQueryService } from './picking-query.service';
import { PickingShippingQueryService } from './picking-shipping-query.service';
import { PickingActionService } from './picking-action.service';

import { DRIZZLE } from '../drizzle/drizzle.module';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { setupPgliteSuite } from '../test-utils/pglite-suite';
import {
  salesOrders,
  salesOrderLineItems,
  salesOrderPicks,
  bins,
  zones,
  locations,
  products,
  customers,
  taxCategories,
  uomDictionary,
  salesEvents,
  outbox,
  actors,
} from '@herobm/db-schema';
import { eq, and } from 'drizzle-orm';
import {
  SALES_ORDER_STATE,
  SALES_ORDER_PICK_STATE,
  PRODUCT_STATE,
  CUSTOMER_STATE,
} from '@herobm/shared';
import { InventoryMovementService } from '../inventory/inventory-movement.service';
import { InventoryQueryService } from '../inventory/inventory-query.service';

describe('PickingService', () => {
  const pg = setupPgliteSuite({ skipSeeds: true });
  let service: PickingService;

  let mockInventoryService: any;

  const ORDER_ID = '00000000-0000-4000-8000-000000000001';
  const CUSTOMER_ID = '00000000-0000-4000-8000-000000000002';
  const PROD_ID = '00000000-0000-4000-8000-00000000000a';
  const LOCATION_ID = '00000000-0000-4000-8000-00000000000f';
  const ZONE_ID = '00000000-0000-4000-8000-00000000000e';
  const STORAGE_BIN_ID = '00000000-0000-4000-8000-00000000000d';
  const SHIPPING_BIN_ID = '00000000-0000-4000-8000-00000000000c';
  const TAX_CAT_ID = '00000000-0000-4000-8000-000000000007';
  const LINE_ID = '00000000-0000-4000-8000-000000000011';

  beforeEach(async () => {
    // Clean data
    await pg.db.delete(salesEvents);
    await pg.db.delete(outbox);
    await pg.db.delete(salesOrderPicks);
    await pg.db.delete(salesOrderLineItems);
    await pg.db.delete(salesOrders);
    await pg.db.delete(products);
    await pg.db.delete(customers);
    await pg.db.delete(bins);
    await pg.db.delete(zones);
    await pg.db.delete(locations);
    await pg.db.delete(taxCategories);
    await pg.db.delete(uomDictionary);

    // Seed infrastructure
    await pg.db
      .insert(uomDictionary)
      .values({ uomCode: 'EA', description: 'Each' });
    await pg.db.insert(taxCategories).values({
      taxCategoryId: TAX_CAT_ID,
      code: 'GST',
      title: 'GST',
      rate: '0.1',
      type: 'tax_applies',
    });
    await pg.db.insert(locations).values({
      locationId: LOCATION_ID,
      code: 'MAIN',
      name: 'Main Warehouse',
      source: 'app',
      createdBy: 'system',
    });
    await pg.db.insert(zones).values({
      zoneId: ZONE_ID,
      locationId: LOCATION_ID,
      code: 'Z1',
      name: 'Zone 1',
      source: 'app',
      createdBy: 'system',
    });
    await pg.db.insert(bins).values([
      {
        binId: STORAGE_BIN_ID,
        zoneId: ZONE_ID,
        binNumber: 'STORAGE-1',
        binType: 'storage',
        source: 'app',
        createdBy: 'system',
        isUnavailable: false,
        isBonded: false,
      },
      {
        binId: SHIPPING_BIN_ID,
        zoneId: ZONE_ID,
        binNumber: 'SHIPPING',
        binType: 'storage',
        source: 'app',
        createdBy: 'system',
        isUnavailable: false,
        isBonded: false,
      },
    ]);
    const custActorId = '00000000-0000-4000-8000-000000000002';
    await pg.db.insert(actors).values({
      actorId: custActorId,
      name: 'Acme Corp',
      headquartersAddressLine1: 'AU',
      isTaxRegistered: false,
    });
    await pg.db.insert(customers).values({
      customerId: CUSTOMER_ID,
      actorId: custActorId,
      customerNumber: 'CUST01',
      currencyCode: 'AUD',
      stateCode: CUSTOMER_STATE.ACTIVE,
      source: 'app',
      createdBy: 'system',
    });
    await pg.db.insert(products).values({
      productId: PROD_ID,
      productNumber: 'PROD-001',
      name: 'Widget A',
      baseUom: 'EA',
      productType: 'inventory',
      stateCode: PRODUCT_STATE.ACTIVE,
      source: 'app',
      structureType: 'standard',
      createdBy: 'system',
    });

    // Mocks
    mockInventoryService = { recordInventoryMovement: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PickingService,
        PickingQueryService,
        PickingShippingQueryService,
        PickingActionService,
        {
          provide: AppConfigService,
          useValue: { defaultFulfillmentLocationId: () => LOCATION_ID },
        },

        { provide: InventoryQueryService, useValue: mockInventoryService },
        { provide: DRIZZLE, useValue: pg.db },
        { provide: InventoryMovementService, useValue: mockInventoryService },
      ],
    }).compile();

    service = module.get<PickingService>(PickingService);
  });

  async function seedOrder(state: any = SALES_ORDER_STATE.PICKING) {
    await pg.db.insert(salesOrders).values({
      salesOrderId: ORDER_ID,
      orderNumber: 'ORD-001',
      customerId: CUSTOMER_ID,
      stateCode: state,
      currencyCode: 'AUD',
      fulfillmentLocationId: LOCATION_ID,
      baseTotalAmount: '0',
      exchangeRate: '1',
      discrepanciesAcknowledged: false,
      source: 'app',
      createdBy: 'system',
    });
    await pg.db.insert(salesOrderLineItems).values({
      salesOrderLineId: LINE_ID,
      salesOrderId: ORDER_ID,
      lineNumber: 1,
      productId: PROD_ID,
      quantity: '10',
      quantityPicked: '0',
      pricePerUnit: '50.00',
      taxCategoryId: TAX_CAT_ID,
      fulfillmentLocationId: LOCATION_ID,
      discountPercentage: '0',
      amount: '0',
      tax: '0',
      isPostConfirmation: false,
    });
  }

  describe('pickLine', () => {
    it('should create a pick record and verify DB state', async () => {
      await seedOrder(SALES_ORDER_STATE.PICKING);

      const result = await service.pickLine(
        ORDER_ID,
        LINE_ID,
        STORAGE_BIN_ID,
        '5',
        'admin',
      );

      expect(result.pickId).toBeDefined();
      expect(result.quantity).toBe('5');

      // Verify picks table instead of line.quantityPicked (which isn't updated by pickLine)
      const picks = await pg.db
        .select()
        .from(salesOrderPicks)
        .where(eq(salesOrderPicks.salesOrderLineId, LINE_ID));
      expect(picks).toHaveLength(1);
      expect(picks[0].quantity).toBe('5');
    });

    it('should reject pick on non-picking state order', async () => {
      await seedOrder(SALES_ORDER_STATE.DRAFT);
      await expect(
        service.pickLine(ORDER_ID, LINE_ID, STORAGE_BIN_ID, '5', 'admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject quantity exceeding ordered', async () => {
      await seedOrder(SALES_ORDER_STATE.PICKING);
      await expect(
        service.pickLine(ORDER_ID, LINE_ID, STORAGE_BIN_ID, '15', 'admin'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('cancelPick', () => {
    it('should cancel an existing pick and reverse physical movement', async () => {
      await seedOrder(SALES_ORDER_STATE.PICKING);

      const pick = await service.pickLine(
        ORDER_ID,
        LINE_ID,
        STORAGE_BIN_ID,
        '5',
        'admin',
      );

      // Verify it was picked
      const beforePicks = await pg.db
        .select()
        .from(salesOrderPicks)
        .where(eq(salesOrderPicks.pickId, pick.pickId));
      expect(beforePicks[0].stateCode).toBe(SALES_ORDER_PICK_STATE.PICKED);

      // Now cancel it
      await service.cancelPick(ORDER_ID, pick.pickId, 'admin');

      // Verify state is cancelled
      const afterPicks = await pg.db
        .select()
        .from(salesOrderPicks)
        .where(eq(salesOrderPicks.pickId, pick.pickId));
      expect(afterPicks[0].stateCode).toBe(SALES_ORDER_PICK_STATE.CANCELLED);

      // Verify physical movement was reversed (mock was called)
      expect(
        mockInventoryService.recordInventoryMovement,
      ).toHaveBeenCalledTimes(2); // Once for pick, once for cancel
    });

    it('should reject cancelling a pick that is not in picked state', async () => {
      await seedOrder(SALES_ORDER_STATE.PICKING);

      // Seed a shipped pick
      const [shippedPick] = await pg.db
        .insert(salesOrderPicks)
        .values({
          salesOrderId: ORDER_ID,
          salesOrderLineId: LINE_ID,
          productId: PROD_ID,
          binId: STORAGE_BIN_ID,
          quantity: '5',
          stateCode: SALES_ORDER_PICK_STATE.SHIPPED, // Invalid state for cancellation
          createdBy: 'system',
        })
        .returning();

      await expect(
        service.cancelPick(ORDER_ID, shippedPick.pickId, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getPickingSummary', () => {
    it('should calculate picked quantities from picks table', async () => {
      await seedOrder(SALES_ORDER_STATE.PICKING);
      await pg.db.insert(salesOrderPicks).values({
        salesOrderId: ORDER_ID,
        salesOrderLineId: LINE_ID,
        productId: PROD_ID,
        binId: STORAGE_BIN_ID,
        quantity: '4',
        stateCode: SALES_ORDER_PICK_STATE.PICKED,
        createdBy: 'system',
      });

      const summary = await service.getPickingSummary(ORDER_ID);
      const line = summary.lines.find((l) => l.salesOrderLineId === LINE_ID);
      expect(line?.quantityPicked).toBe('4');
      expect(line?.remaining).toBe('6');
      expect(line?.isFullyPicked).toBe(false);
    });
  });

  describe('assertFullyPicked', () => {
    it('should pass when all lines fully picked', async () => {
      await seedOrder(SALES_ORDER_STATE.PICKING);
      await pg.db.insert(salesOrderPicks).values({
        salesOrderId: ORDER_ID,
        salesOrderLineId: LINE_ID,
        productId: PROD_ID,
        binId: STORAGE_BIN_ID,
        quantity: '10',
        stateCode: SALES_ORDER_PICK_STATE.PICKED,
        createdBy: 'system',
      });

      await expect(
        service.assertFullyPicked(ORDER_ID),
      ).resolves.toBeUndefined();
    });

    it('should throw when lines not fully picked', async () => {
      await seedOrder(SALES_ORDER_STATE.PICKING);
      await pg.db.insert(salesOrderPicks).values({
        salesOrderId: ORDER_ID,
        salesOrderLineId: LINE_ID,
        productId: PROD_ID,
        binId: STORAGE_BIN_ID,
        quantity: '7',
        stateCode: SALES_ORDER_PICK_STATE.PICKED,
        createdBy: 'system',
      });

      await expect(service.assertFullyPicked(ORDER_ID)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getPickingQueue', () => {
    it('should return paginated picking queue results with meta', async () => {
      await seedOrder(SALES_ORDER_STATE.CONFIRMED);
      const res = (await service.getPickingQueue({
        page: 1,
        limit: 10,
      })) as any;
      expect(res).toHaveProperty('data');
      expect(res).toHaveProperty('meta');
      expect(res.meta.page).toBe(1);
      expect(res.meta.limit).toBe(10);
      expect(Array.isArray(res.data)).toBe(true);
    });
  });
});
