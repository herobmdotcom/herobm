import { Test, TestingModule } from '@nestjs/testing';
import { PurchaseReturnsService } from './purchase-returns.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { setupPgliteSuite } from '../test-utils/pglite-suite';
import { GlService } from '../gl/gl.service';
import { AppConfigService } from '../settings/app-config.service';
import {
  actors,
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
} from '@herobm/db-schema';
import { eq, and } from 'drizzle-orm';
import {
  PURCHASE_ORDER_STATE,
  PURCHASE_RETURN_STATE,
  PURCHASE_RETURN_SHIPMENT_STATE,
  SUPPLIER_STATE,
  PRODUCT_STATE,
  ACTOR_STATE,
} from '@herobm/shared';
import * as lifecycleRules from './purchase-order-lifecycle-rules';
import { InventoryMovementService } from '../inventory/inventory-movement.service';
import { InventoryQueryService } from '../inventory/inventory-query.service';

describe('PurchaseReturnsService', () => {
  const pg = setupPgliteSuite({ skipSeeds: true });
  let service: PurchaseReturnsService;

  let mockInventoryService: any;
  let mockGlService: any;
  let mockAppConfig: any;

  const VENDOR_ID = '00000000-0000-4000-8000-000000000001';
  const LOCATION_ID = '00000000-0000-4000-8000-00000000000f';
  const PROD_ID = '00000000-0000-4000-8000-00000000000a';
  const ZONE_ID = '00000000-0000-4000-8000-00000000000c';
  const SOURCE_BIN_ID = '00000000-0000-4000-8000-00000000000d';
  const TAX_CAT_ID = '00000000-0000-4000-8000-000000000007';

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
      defaultPpvAccountId: () => 'ppv-acc',
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchaseReturnsService,
        { provide: DRIZZLE, useValue: pg.db },
        { provide: InventoryQueryService, useValue: mockInventoryService },
        { provide: GlService, useValue: mockGlService },
        { provide: AppConfigService, useValue: mockAppConfig },
        { provide: InventoryMovementService, useValue: mockInventoryService },
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
    const actorId = '0e3c4e85-d865-4f40-8abf-c4e89e47261d';
    await pg.db.insert(actors).values({
      stateCode: ACTOR_STATE.ACTIVE,
      actorId,
      name: 'Supplier 1',
      headquartersAddressLine1: 'AU',
      isTaxRegistered: false,
    });
    await pg.db.insert(suppliers).values({
      vendorId: VENDOR_ID,
      actorId,
      vendorNumber: 'V1',
      currencyCode: 'EUR',
      stateCode: SUPPLIER_STATE.ACTIVE,
      source: 'app',
      isPurchasingBlocked: false,
      createdBy: 'system',
    });
    await pg.db.insert(locations).values({
      locationId: LOCATION_ID,
      code: 'MAIN',
      name: 'Main',
      source: 'app',
      createdBy: 'system',
    });
    await pg.db.insert(products).values({
      productId: PROD_ID,
      productNumber: 'P1',
      name: 'Product 1',
      productType: 'inventory',
      baseUom: 'EA',
      standardCost: '10',
      stateCode: PRODUCT_STATE.ACTIVE,
      source: 'app',
      structureType: 'standard',
      createdBy: 'system',
    });
    await pg.db.insert(zones).values({
      zoneId: ZONE_ID,
      locationId: LOCATION_ID,
      code: 'RECV',
      name: 'Receiving Zone',
      source: 'app',
      createdBy: 'system',
    });
    await pg.db.insert(bins).values({
      binId: SOURCE_BIN_ID,
      zoneId: ZONE_ID,
      binNumber: 'QUARANTINE-01',
      binType: 'quarantine',
      source: 'app',
      createdBy: 'system',
      isUnavailable: false,
      isBonded: false,
    });
  }

  async function getSupplierReturnsBinId() {
    const [b] = await pg.db
      .select({ binId: bins.binId })
      .from(bins)
      .innerJoin(zones, eq(bins.zoneId, zones.zoneId))
      .where(
        and(
          eq(bins.binNumber, 'SUPPLIER_RETURNS'),
          eq(zones.locationId, LOCATION_ID),
        ),
      )
      .limit(1);
    return b.binId;
  }

  describe('stageReturn', () => {
    it('should throw BadRequestException if sourceBinId is missing', async () => {
      await seedBasics();
      const PO_ID = '00000000-0000-4000-8000-000000000001';
      const PO_LINE_ID = '00000000-0000-4000-8000-000000000002';
      const RETURN_ID = '00000000-0000-4000-8000-000000000003';

      await pg.db.insert(purchaseOrders).values({
        purchaseOrderId: PO_ID,
        orderNumber: 'PO-001',
        vendorId: VENDOR_ID,
        deliveryLocationId: LOCATION_ID,
        currencyCode: 'EUR',
        stateCode: PURCHASE_ORDER_STATE.RECEIVED,
        baseTotalAmount: '0',
        exchangeRate: '1',
        createdBy: 'system',
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
        discountPercentage: '0',
        amount: '0',
        tax: '0',
      });
      await pg.db.insert(purchaseOrderReturns).values({
        returnId: RETURN_ID,
        returnNumber: 'PRT-1',
        purchaseOrderId: PO_ID,
        stateCode: PURCHASE_RETURN_STATE.DRAFT,
        createdBy: 'system',
      });
      await pg.db.insert(purchaseOrderReturnLines).values({
        returnId: RETURN_ID,
        purchaseOrderLineId: PO_LINE_ID,
        quantityReturned: '5',
        sourceBinId: null,
      });

      await expect(service.stageReturn(RETURN_ID, 'admin')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should stage return with explicit sourceBinId and record balanced inventory transfer', async () => {
      await seedBasics();
      const PO_ID = '00000000-0000-4000-8000-000000000001';
      const PO_LINE_ID = '00000000-0000-4000-8000-000000000002';
      const RETURN_ID = '00000000-0000-4000-8000-000000000003';

      await pg.db.insert(purchaseOrders).values({
        purchaseOrderId: PO_ID,
        orderNumber: 'PO-001',
        vendorId: VENDOR_ID,
        deliveryLocationId: LOCATION_ID,
        currencyCode: 'EUR',
        stateCode: PURCHASE_ORDER_STATE.RECEIVED,
        baseTotalAmount: '0',
        exchangeRate: '1',
        createdBy: 'system',
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
        discountPercentage: '0',
        amount: '0',
        tax: '0',
      });
      await pg.db.insert(purchaseOrderReturns).values({
        returnId: RETURN_ID,
        returnNumber: 'PRT-1',
        purchaseOrderId: PO_ID,
        stateCode: PURCHASE_RETURN_STATE.DRAFT,
        createdBy: 'system',
      });
      await pg.db.insert(purchaseOrderReturnLines).values({
        returnId: RETURN_ID,
        purchaseOrderLineId: PO_LINE_ID,
        quantityReturned: '5',
        sourceBinId: SOURCE_BIN_ID,
      });

      await service.stageReturn(RETURN_ID, 'admin');

      const supplierReturnsBinId = await getSupplierReturnsBinId();
      const [ret] = await pg.db
        .select()
        .from(purchaseOrderReturns)
        .where(eq(purchaseOrderReturns.returnId, RETURN_ID));
      expect(ret.stateCode).toBe(PURCHASE_RETURN_STATE.STAGED);

      expect(
        mockInventoryService.recordInventoryMovement,
      ).toHaveBeenCalledTimes(1);
      const call =
        mockInventoryService.recordInventoryMovement.mock.calls[0][1];
      expect(call.lines).toHaveLength(2);
      expect(call.lines[0]).toEqual({
        productId: PROD_ID,
        binId: SOURCE_BIN_ID,
        quantity: -5,
        uomCode: 'EA',
      });
      expect(call.lines[1]).toEqual({
        productId: PROD_ID,
        binId: supplierReturnsBinId,
        quantity: 5,
        uomCode: 'EA',
      });
    });
  });

  describe('unstageReturn', () => {
    it('should unstage return and reverse inventory transfer back to source bin', async () => {
      await seedBasics();
      const PO_ID = '00000000-0000-4000-8000-000000000001';
      const PO_LINE_ID = '00000000-0000-4000-8000-000000000002';
      const RETURN_ID = '00000000-0000-4000-8000-000000000003';

      await pg.db.insert(purchaseOrders).values({
        purchaseOrderId: PO_ID,
        orderNumber: 'PO-001',
        vendorId: VENDOR_ID,
        deliveryLocationId: LOCATION_ID,
        currencyCode: 'EUR',
        stateCode: PURCHASE_ORDER_STATE.RECEIVED,
        baseTotalAmount: '0',
        exchangeRate: '1',
        createdBy: 'system',
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
        discountPercentage: '0',
        amount: '0',
        tax: '0',
      });
      await pg.db.insert(purchaseOrderReturns).values({
        returnId: RETURN_ID,
        returnNumber: 'PRT-1',
        purchaseOrderId: PO_ID,
        stateCode: PURCHASE_RETURN_STATE.STAGED,
        createdBy: 'system',
      });
      await pg.db.insert(purchaseOrderReturnLines).values({
        returnId: RETURN_ID,
        purchaseOrderLineId: PO_LINE_ID,
        quantityReturned: '5',
        sourceBinId: SOURCE_BIN_ID,
      });

      await service.unstageReturn(RETURN_ID, 'admin');

      const supplierReturnsBinId = await getSupplierReturnsBinId();
      const [ret] = await pg.db
        .select()
        .from(purchaseOrderReturns)
        .where(eq(purchaseOrderReturns.returnId, RETURN_ID));
      expect(ret.stateCode).toBe(PURCHASE_RETURN_STATE.DRAFT);

      expect(
        mockInventoryService.recordInventoryMovement,
      ).toHaveBeenCalledTimes(1);
      const call =
        mockInventoryService.recordInventoryMovement.mock.calls[0][1];
      expect(call.lines).toHaveLength(2);
      expect(call.lines[0]).toEqual({
        productId: PROD_ID,
        binId: supplierReturnsBinId,
        quantity: -5,
        uomCode: 'EA',
      });
      expect(call.lines[1]).toEqual({
        productId: PROD_ID,
        binId: SOURCE_BIN_ID,
        quantity: 5,
        uomCode: 'EA',
      });
    });
  });

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

      const PO_ID = '00000000-0000-4000-8000-000000000001';
      const PO_LINE_ID = '00000000-0000-4000-8000-000000000002';
      const RETURN_ID = '00000000-0000-4000-8000-000000000003';

      await pg.db.insert(purchaseOrders).values({
        purchaseOrderId: PO_ID,
        orderNumber: 'PO-001',
        vendorId: VENDOR_ID,
        deliveryLocationId: LOCATION_ID,
        currencyCode: 'EUR',
        stateCode: PURCHASE_ORDER_STATE.RECEIVED,
        baseTotalAmount: '0',
        exchangeRate: '1',
        createdBy: 'system',
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
        discountPercentage: '0',
        amount: '0',
        tax: '0',
      });

      await pg.db.insert(purchaseOrderReturns).values({
        returnId: RETURN_ID,
        returnNumber: 'PRT-1',
        purchaseOrderId: PO_ID,
        stateCode: PURCHASE_RETURN_STATE.STAGED,
        createdBy: 'system',
      });

      await pg.db.insert(purchaseOrderReturnLines).values({
        returnId: RETURN_ID,
        purchaseOrderLineId: PO_LINE_ID,
        quantityReturned: '5',
        sourceBinId: SOURCE_BIN_ID,
        returnFee: '0',
      });

      jest.clearAllMocks();

      await service.shipReturn(RETURN_ID, 'admin', {
        trackingNumber: 'TRACK-123',
      });

      const supplierReturnsBinId = await getSupplierReturnsBinId();
      const [ret] = await pg.db
        .select()
        .from(purchaseOrderReturns)
        .where(eq(purchaseOrderReturns.returnId, RETURN_ID));
      expect(ret.stateCode).toBe(PURCHASE_RETURN_STATE.SHIPPED);

      const [shipment] = await pg.db
        .select()
        .from(purchaseOrderReturnShipments)
        .where(eq(purchaseOrderReturnShipments.returnId, RETURN_ID));
      expect(shipment).toBeDefined();
      expect(shipment.stateCode).toBe(
        PURCHASE_RETURN_SHIPMENT_STATE.DISPATCHED,
      );
      expect(shipment.trackingNumber).toBe('TRACK-123');

      const [poLine] = await pg.db
        .select()
        .from(purchaseOrderLineItems)
        .where(eq(purchaseOrderLineItems.purchaseOrderLineId, PO_LINE_ID));
      expect(poLine.quantityReceived).toBe('15');

      expect(
        mockInventoryService.recordInventoryMovement,
      ).toHaveBeenCalledTimes(1);
      const inventoryCall =
        mockInventoryService.recordInventoryMovement.mock.calls[0][1];
      expect(inventoryCall.lines).toHaveLength(1);
      expect(inventoryCall.lines[0].quantity).toBe(-5);
      expect(inventoryCall.lines[0].binId).toBe(supplierReturnsBinId);

      expect(mockGlService.postJournalEntry).toHaveBeenCalledTimes(1);
      const glCallLines = mockGlService.postJournalEntry.mock.calls[0][0];
      expect(glCallLines).toHaveLength(2);
      expect(
        glCallLines.find((l: any) => l.accountId === 'grni-acc').debit,
      ).toBe(50);
      expect(
        glCallLines.find((l: any) => l.accountId === 'inv-acc').credit,
      ).toBe(50);
    });

    it('should throw an error if the return is not STAGED', async () => {
      await seedBasics();

      const PO_ID = '00000000-0000-4000-8000-000000000001';
      const RETURN_ID = '00000000-0000-4000-8000-000000000003';

      await pg.db.insert(purchaseOrders).values({
        purchaseOrderId: PO_ID,
        orderNumber: 'PO-001',
        vendorId: VENDOR_ID,
        deliveryLocationId: LOCATION_ID,
        currencyCode: 'EUR',
        stateCode: PURCHASE_ORDER_STATE.RECEIVED,
        baseTotalAmount: '0',
        exchangeRate: '1',
        createdBy: 'system',
      });

      await pg.db.insert(purchaseOrderReturns).values({
        returnId: RETURN_ID,
        returnNumber: 'PRT-1',
        purchaseOrderId: PO_ID,
        stateCode: PURCHASE_RETURN_STATE.DRAFT,
        createdBy: 'system',
      });

      await expect(service.shipReturn(RETURN_ID, 'admin')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('unshipReturn', () => {
    it('should unship return, restore inventory to SUPPLIER_RETURNS, and restore PO quantityReceived', async () => {
      await seedBasics();
      const PO_ID = '00000000-0000-4000-8000-000000000001';
      const PO_LINE_ID = '00000000-0000-4000-8000-000000000002';
      const RETURN_ID = '00000000-0000-4000-8000-000000000003';

      await pg.db.insert(purchaseOrders).values({
        purchaseOrderId: PO_ID,
        orderNumber: 'PO-001',
        vendorId: VENDOR_ID,
        deliveryLocationId: LOCATION_ID,
        currencyCode: 'EUR',
        stateCode: PURCHASE_ORDER_STATE.RECEIVED,
        baseTotalAmount: '0',
        exchangeRate: '1',
        createdBy: 'system',
      });

      await pg.db.insert(purchaseOrderLineItems).values({
        purchaseOrderLineId: PO_LINE_ID,
        purchaseOrderId: PO_ID,
        productId: PROD_ID,
        lineNumber: 1,
        quantity: '20',
        quantityReceived: '15',
        pricePerUnit: '10',
        taxCategoryId: TAX_CAT_ID,
        discountPercentage: '0',
        amount: '0',
        tax: '0',
      });

      await pg.db.insert(purchaseOrderReturns).values({
        returnId: RETURN_ID,
        returnNumber: 'PRT-1',
        purchaseOrderId: PO_ID,
        stateCode: PURCHASE_RETURN_STATE.SHIPPED,
        createdBy: 'system',
      });

      await pg.db.insert(purchaseOrderReturnLines).values({
        returnId: RETURN_ID,
        purchaseOrderLineId: PO_LINE_ID,
        quantityReturned: '5',
        sourceBinId: SOURCE_BIN_ID,
      });

      jest.clearAllMocks();

      await service.unshipReturn(RETURN_ID, 'admin');

      const supplierReturnsBinId = await getSupplierReturnsBinId();
      const [ret] = await pg.db
        .select()
        .from(purchaseOrderReturns)
        .where(eq(purchaseOrderReturns.returnId, RETURN_ID));
      expect(ret.stateCode).toBe(PURCHASE_RETURN_STATE.STAGED);

      const [poLine] = await pg.db
        .select()
        .from(purchaseOrderLineItems)
        .where(eq(purchaseOrderLineItems.purchaseOrderLineId, PO_LINE_ID));
      expect(poLine.quantityReceived).toBe('20');

      expect(
        mockInventoryService.recordInventoryMovement,
      ).toHaveBeenCalledTimes(1);
      const call =
        mockInventoryService.recordInventoryMovement.mock.calls[0][1];
      expect(call.lines[0]).toEqual({
        productId: PROD_ID,
        binId: supplierReturnsBinId,
        quantity: 5,
        uomCode: 'EA',
      });
    });
  });
});
