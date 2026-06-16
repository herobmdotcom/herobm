import { Test, TestingModule } from '@nestjs/testing';
import { PurchaseReturnsService } from './purchase-returns.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { InventoryService } from '../inventory/inventory.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { setupPgliteSuite } from '../test-utils/pglite-suite';
import { GlService } from '../gl/gl.service';
import { AppConfigService } from '../settings/app-config.service';
import {
  suppliers,
  locations,
  products,
  purchaseOrders,
  purchaseOrderLineItems,
  purchaseOrderReturns,
  purchaseOrderReturnLines,
  purchaseOrderReturnShipments,
  zones,
  bins,
  uomDictionary,
  taxCategories,
  glJournalEntries,
} from '../drizzle/herobm-core-schema';
import { PgliteDatabase } from 'drizzle-orm/pglite';
import { eq, sql } from 'drizzle-orm';
import {
  PURCHASE_ORDER_STATE,
  PURCHASE_RETURN_STATE,
  PURCHASE_RETURN_SHIPMENT_STATE,
} from '@herobm/shared';
import * as lifecycleRules from './purchase-order-lifecycle-rules';

describe('PurchaseReturnsService', () => {
  const pg = setupPgliteSuite({ skipSeeds: true });
  let service: PurchaseReturnsService;

  let mockInventoryService: any;

  let mockGlService: any;

  let mockAppConfig: any;

  const VENDOR_ID = '00000000-0000-0000-0000-000000000001';
  const LOCATION_ID = '00000000-0000-0000-0000-00000000000f';
  const PROD_ID = '00000000-0000-0000-0000-00000000000a';
  const ZONE_ID = '00000000-0000-0000-0000-00000000000c';
  const BIN_ID = '00000000-0000-0000-0000-00000000000b';
  const TAX_CAT_ID = '00000000-0000-0000-0000-000000000007';

  beforeEach(async () => {
    // Seed static data
    await pg.db
      .insert(uomDictionary)
      .values({ uomCode: 'EA', description: 'Each' })
      .onConflictDoNothing();
    await pg.db
      .insert(taxCategories)
      .values({
        taxCategoryId: TAX_CAT_ID,
        code: 'GST',
        title: 'GST',
        rate: '0.1',
        type: 'tax_applies',
      })
      .onConflictDoNothing();
  });

  beforeEach(async () => {
    mockInventoryService = {
      recordInventoryMovement: jest.fn().mockResolvedValue(undefined),
    };
    mockGlService = {
      postJournalEntry: jest.fn().mockResolvedValue({ success: true }),
    };
    mockAppConfig = {
      get: () => ({
        systemBaseCurrency: 'EUR',
      }),
      inventoryAccountingMode: () => 'perpetual',
      defaultInventoryAccountId: () => 'inv-acc',
      defaultGrniAccountId: () => 'grni-acc',
      defaultCogsAccountId: () => 'cogs-acc',
      defaultShrinkageAccountId: () => 'shrink-acc',
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchaseReturnsService,
        { provide: DRIZZLE, useValue: pg.db },
        { provide: InventoryService, useValue: mockInventoryService },
        { provide: GlService, useValue: mockGlService },
        { provide: AppConfigService, useValue: mockAppConfig },
      ],
    }).compile();

    service = module.get<PurchaseReturnsService>(PurchaseReturnsService);

    // Clean tables in order
    await pg.db.delete(purchaseOrderReturnShipments);
    await pg.db.delete(purchaseOrderReturnLines);
    await pg.db.delete(purchaseOrderReturns);
    await pg.db.delete(purchaseOrderLineItems);
    await pg.db.delete(purchaseOrders);
    await pg.db.delete(bins);
    await pg.db.delete(zones);
    await pg.db.delete(products);
    await pg.db.delete(locations);
    await pg.db.delete(suppliers);
  });

  async function seedBasics() {
    await pg.db.insert(suppliers).values({
      vendorId: VENDOR_ID,
      vendorNumber: 'V1',
      name: 'Supplier 1',
      currencyCode: 'EUR',
      address1Country: 'AU',
    });
    await pg.db.insert(locations).values({
      locationId: LOCATION_ID,
      code: 'MAIN',
      name: 'Main',
    });
    await pg.db.insert(products).values({
      productId: PROD_ID,
      productNumber: 'P1',
      name: 'Product 1',
      baseUom: 'EA',
      standardCost: '10',
    });
    await pg.db.insert(zones).values({
      zoneId: ZONE_ID,
      locationId: LOCATION_ID,
      code: 'RECV',
      name: 'Receiving Zone',
    });
    await pg.db.insert(bins).values({
      binId: BIN_ID,
      zoneId: ZONE_ID,
      binNumber: 'SUPPLIER_RETURNS',
      binType: 'storage',
    });
  }

  describe('shipReturn', () => {
    let evaluateSpy: jest.SpyInstance;

    beforeEach(() => {
      evaluateSpy = jest
        .spyOn(lifecycleRules, 'evaluatePOLifecycleRules')
        .mockResolvedValue([]);
    });

    afterEach(() => {
      evaluateSpy.mockRestore();
    });

    it('should successfully ship a staged return, deduct inventory, post GL, and trigger engine', async () => {
      await seedBasics();

      const PO_ID = '00000000-0000-0000-0000-000000000001';
      const PO_LINE_ID = '00000000-0000-0000-0000-000000000002';
      const RETURN_ID = '00000000-0000-0000-0000-000000000003';

      await pg.db.insert(purchaseOrders).values({
        purchaseOrderId: PO_ID,
        orderNumber: 'PO-001',
        vendorId: VENDOR_ID,
        deliveryLocationId: LOCATION_ID,
        currencyCode: 'EUR',
        stateCode: PURCHASE_ORDER_STATE.RECEIVED,
      });

      await pg.db.insert(purchaseOrderLineItems).values({
        purchaseOrderLineId: PO_LINE_ID,
        purchaseOrderId: PO_ID,
        productId: PROD_ID,
        lineNumber: 1,
        quantity: '20',
        quantityReceived: '20',
        pricePerUnit: '10',
        taxCategoryId: TAX_CAT_ID,
      });

      await pg.db.insert(purchaseOrderReturns).values({
        returnId: RETURN_ID,
        returnNumber: 'PRT-1',
        purchaseOrderId: PO_ID,
        stateCode: PURCHASE_RETURN_STATE.STAGED,
      });

      await pg.db.insert(purchaseOrderReturnLines).values({
        returnId: RETURN_ID,
        purchaseOrderLineId: PO_LINE_ID,
        quantityReturned: '5',
      });

      // Clear mock calls
      jest.clearAllMocks();

      // Execute Ship
      await service.shipReturn(RETURN_ID, 'admin');

      // Assert 1: Return state is SHIPPED
      const [ret] = await pg.db
        .select()
        .from(purchaseOrderReturns)
        .where(eq(purchaseOrderReturns.returnId, RETURN_ID));
      expect(ret.stateCode).toBe(PURCHASE_RETURN_STATE.SHIPPED);

      // Assert 2: Shipment generated
      const [shipment] = await pg.db
        .select()
        .from(purchaseOrderReturnShipments)
        .where(eq(purchaseOrderReturnShipments.returnId, RETURN_ID));
      expect(shipment).toBeDefined();
      expect(shipment.stateCode).toBe(
        PURCHASE_RETURN_SHIPMENT_STATE.DISPATCHED,
      );

      // Assert 3: PO quantity received was decremented
      const [poLine] = await pg.db
        .select()
        .from(purchaseOrderLineItems)
        .where(eq(purchaseOrderLineItems.purchaseOrderLineId, PO_LINE_ID));
      expect(poLine.quantityReceived).toBe('15');

      // Assert 4: Inventory movement was recorded
      expect(
        mockInventoryService.recordInventoryMovement,
      ).toHaveBeenCalledTimes(1);
      const inventoryCall =
        mockInventoryService.recordInventoryMovement.mock.calls[0][1];
      expect(inventoryCall.lines).toHaveLength(1);
      expect(inventoryCall.lines[0].quantity).toBe(-5); // Deducted 5
      expect(inventoryCall.lines[0].binId).toBeDefined();

      // Assert 5: GL entry was posted
      expect(mockGlService.postJournalEntry).toHaveBeenCalledTimes(1);
      const glCallLines = mockGlService.postJournalEntry.mock.calls[0][0];
      // Expect DR GRNI (amount = 5 * $10 = $50), CR Inventory
      expect(glCallLines).toHaveLength(2);
      expect(
        glCallLines.find((l: any) => l.accountId === 'grni-acc').debit,
      ).toBe(50);
      expect(
        glCallLines.find((l: any) => l.accountId === 'inv-acc').credit,
      ).toBe(50);

      // Assert 6: evaluatePOLifecycleRules was triggered
      expect(evaluateSpy).toHaveBeenCalledTimes(1);
      const engineCallArgs = evaluateSpy.mock.calls[0];
      expect(engineCallArgs[1]).toBe(PO_ID);
      expect(engineCallArgs[2]).toEqual({
        entity: 'purchase_return',
        action: 'shipped',
        id: RETURN_ID,
      });
    });

    it('should throw an error if the return is not STAGED', async () => {
      await seedBasics();

      const PO_ID = '00000000-0000-0000-0000-000000000001';
      const RETURN_ID = '00000000-0000-0000-0000-000000000003';

      await pg.db.insert(purchaseOrders).values({
        purchaseOrderId: PO_ID,
        orderNumber: 'PO-001',
        vendorId: VENDOR_ID,
        deliveryLocationId: LOCATION_ID,
        currencyCode: 'EUR',
        stateCode: PURCHASE_ORDER_STATE.RECEIVED,
      });

      await pg.db.insert(purchaseOrderReturns).values({
        returnId: RETURN_ID,
        returnNumber: 'PRT-1',
        purchaseOrderId: PO_ID,
        stateCode: PURCHASE_RETURN_STATE.DRAFT, // Not STAGED
      });

      await expect(service.shipReturn(RETURN_ID, 'admin')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
