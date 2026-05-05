import { AppConfigService } from '../settings/app-config.service';
import { Test, TestingModule } from '@nestjs/testing';
import { PickingService } from './picking.service';
import { ShipmentService } from './shipment.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { InventoryService } from '../inventory/inventory.service';
import { setupPgliteSuite } from '../test-utils/pglite-suite';
import {
  salesOrders,
  salesOrderLineItems,
  salesOrderPicks,
  bins,
  zones,
  locations,
  products,
  accounts,
  taxCategories,
  uomDictionary,
  orderEvents,
  outbox,
} from '../drizzle/modbm-core-schema';
import { eq, and } from 'drizzle-orm';

describe('PickingService', () => {
  const pg = setupPgliteSuite({ skipSeeds: true });
  let service: PickingService;
  let mockInventoryService: any;
  let mockShipmentService: any;

  const ORDER_ID = '00000000-0000-0000-0000-000000000001';
  const CUSTOMER_ID = '00000000-0000-0000-0000-000000000002';
  const PROD_ID = '00000000-0000-0000-0000-00000000000a';
  const LOCATION_ID = '00000000-0000-0000-0000-00000000000f';
  const ZONE_ID = '00000000-0000-0000-0000-00000000000e';
  const STORAGE_BIN_ID = '00000000-0000-0000-0000-00000000000d';
  const SHIPPING_BIN_ID = '00000000-0000-0000-0000-00000000000c';
  const TAX_CAT_ID = '00000000-0000-0000-0000-000000000007';
  const LINE_ID = '00000000-0000-0000-0000-000000000011';

  beforeEach(async () => {
    // Clean data
    await pg.db.delete(orderEvents);
    await pg.db.delete(outbox);
    await pg.db.delete(salesOrderPicks);
    await pg.db.delete(salesOrderLineItems);
    await pg.db.delete(salesOrders);
    await pg.db.delete(products);
    await pg.db.delete(accounts);
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
    });
    await pg.db.insert(zones).values({
      zoneId: ZONE_ID,
      locationId: LOCATION_ID,
      code: 'Z1',
      name: 'Zone 1',
    });
    await pg.db.insert(bins).values([
      {
        binId: STORAGE_BIN_ID,
        zoneId: ZONE_ID,
        binNumber: 'STORAGE-1',
        binType: 'storage',
      },
      {
        binId: SHIPPING_BIN_ID,
        zoneId: ZONE_ID,
        binNumber: 'SHIPPING',
        binType: 'storage',
      },
    ]);
    await pg.db.insert(accounts).values({
      accountId: CUSTOMER_ID,
      accountNumber: 'CUST01',
      name: 'Acme Corp',
      currencyCode: 'AUD',
      stateCode: 'active',
      source: 'app',
    });
    await pg.db.insert(products).values({
      productId: PROD_ID,
      productNumber: 'PROD-001',
      name: 'Widget A',
      baseUom: 'EA',
      productType: 'inventory',
    });

    // Mocks
    mockInventoryService = { recordInventoryMovement: jest.fn() };
    mockShipmentService = { createShipment: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PickingService,
        {
          provide: AppConfigService,
          useValue: { defaultFulfillmentLocationId: () => LOCATION_ID },
        },
        { provide: ShipmentService, useValue: mockShipmentService },
        { provide: InventoryService, useValue: mockInventoryService },
        { provide: DRIZZLE, useValue: pg.db },
      ],
    }).compile();

    service = module.get<PickingService>(PickingService);
  });

  async function seedOrder(state: any = 'picking') {
    await pg.db.insert(salesOrders).values({
      salesOrderId: ORDER_ID,
      orderNumber: 'ORD-001',
      customerId: CUSTOMER_ID,
      stateCode: state,
      currencyCode: 'AUD',
      fulfillmentLocationId: LOCATION_ID,
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
    });
  }

  describe('pickLine', () => {
    it('should create a pick record and verify DB state', async () => {
      await seedOrder('picking');

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
      await seedOrder('draft');
      await expect(
        service.pickLine(ORDER_ID, LINE_ID, STORAGE_BIN_ID, '5', 'admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject quantity exceeding ordered', async () => {
      await seedOrder('picking');
      await expect(
        service.pickLine(ORDER_ID, LINE_ID, STORAGE_BIN_ID, '15', 'admin'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getPickingSummary', () => {
    it('should calculate picked quantities from picks table', async () => {
      await seedOrder('picking');
      await pg.db.insert(salesOrderPicks).values({
        salesOrderId: ORDER_ID,
        salesOrderLineId: LINE_ID,
        productId: PROD_ID,
        binId: STORAGE_BIN_ID,
        quantity: '4',
        stateCode: 'picked',
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
      await seedOrder('picking');
      await pg.db.insert(salesOrderPicks).values({
        salesOrderId: ORDER_ID,
        salesOrderLineId: LINE_ID,
        productId: PROD_ID,
        binId: STORAGE_BIN_ID,
        quantity: '10',
        stateCode: 'picked',
      });

      await expect(
        service.assertFullyPicked(ORDER_ID),
      ).resolves.toBeUndefined();
    });

    it('should throw when lines not fully picked', async () => {
      await seedOrder('picking');
      await pg.db.insert(salesOrderPicks).values({
        salesOrderId: ORDER_ID,
        salesOrderLineId: LINE_ID,
        productId: PROD_ID,
        binId: STORAGE_BIN_ID,
        quantity: '7',
        stateCode: 'picked',
      });

      await expect(service.assertFullyPicked(ORDER_ID)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
