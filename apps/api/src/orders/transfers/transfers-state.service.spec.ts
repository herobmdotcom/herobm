import { TransfersStateService } from './transfers-state.service';
import { TransfersCoreService } from './transfers-core.service';
import { InventoryMovementService } from '../../inventory/inventory-movement.service';
import { setupPgliteSuite } from '../../test-utils/pglite-suite';
import {
  transferOrders,
  locations,
  products,
  transferOrderLines,
  transferOrderShipments,
  transferOrderReceiptLines,
  warehouseEvents,
  uomDictionary,
  taxCategories,
  zones,
  bins,
  binContents,
  projects,
  customers,
} from '@herobm/db-schema';
import { eq } from 'drizzle-orm';
import {
  TRANSFER_ORDER_STATE,
  PRODUCT_STATE,
  SHIPMENT_STATE,
  CUSTOMER_STATE,
  PROJECT_STATE,
  PROJECT_BILLING_TYPE,
  PUTAWAY_STATUS,
  BIN_TYPE,
} from '@herobm/shared';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BackordersService } from '../backorders.service';

describe('TransfersStateService', () => {
  const pg = setupPgliteSuite({ skipSeeds: true });
  let service: TransfersStateService;
  let inventoryMovementService: InventoryMovementService;

  const LOCATION_SRC_ID = '00000000-0000-4000-8000-000000000001';
  const LOCATION_DST_ID = '00000000-0000-4000-8000-000000000002';
  const PROD_ID = '00000000-0000-4000-8000-000000000003';
  const TRANSFER_ID = '00000000-0000-4000-8000-000000000004';
  const TRANSFER_LINE_ID = '00000000-0000-4000-8000-000000000010';

  beforeEach(async () => {
    await pg.db
      .insert(uomDictionary)
      .values({ uomCode: 'EA', description: 'Each', category: 'goods' });
    await pg.db.insert(taxCategories).values({
      taxCategoryId: '00000000-0000-4000-8000-000000000000',
      code: 'GST',
      title: 'GST',
      rate: '0.1',
      type: 'tax_applies',
    });
    await pg.db.insert(locations).values([
      {
        locationId: LOCATION_SRC_ID,
        code: 'SRC',
        name: 'Source',
        source: 'app',
        createdBy: 'system',
      },
      {
        locationId: LOCATION_DST_ID,
        code: 'DST',
        name: 'Dest',
        source: 'app',
        createdBy: 'system',
      },
    ]);

    await pg.db.insert(products).values({
      productId: PROD_ID,
      productNumber: 'PROD-1',
      name: 'Test Product',
      productType: 'inventory',
      structureType: 'standard',
      baseUom: 'EA',
      stateCode: PRODUCT_STATE.ACTIVE,
      salesTaxCategoryId: '00000000-0000-4000-8000-000000000000',
      purchaseTaxCategoryId: '00000000-0000-4000-8000-000000000000',
      source: 'app',
      createdBy: 'system',
    });

    const coreService = new TransfersCoreService(pg.db);
    inventoryMovementService = {
      reserveStockForTransferOrder: jest.fn().mockResolvedValue([]),
      unreserveStockForTransferOrder: jest.fn().mockResolvedValue([]),
      shipTransferOrderStock: jest.fn().mockResolvedValue([]),
      receiveTransferOrderStock: jest.fn().mockResolvedValue([]),
      recordInventoryMovement: jest.fn().mockResolvedValue({}),
    } as unknown as InventoryMovementService;
    const backordersService = {
      unlinkDemandForTransferOrder: jest.fn().mockResolvedValue(undefined),
    } as unknown as BackordersService;

    service = new TransfersStateService(
      pg.db,
      inventoryMovementService,
      coreService,
      backordersService,
    );
  });

  describe('updateState', () => {
    beforeEach(async () => {
      await pg.db.insert(transferOrders).values({
        transferOrderId: TRANSFER_ID,
        orderNumber: 'TO-123',
        sourceLocationId: LOCATION_SRC_ID,
        destinationLocationId: LOCATION_DST_ID,
        isProjectReturn: false,
        stateCode: TRANSFER_ORDER_STATE.CONFIRMED,
        createdBy: 'system',
      });
      await pg.db.insert(transferOrderLines).values({
        transferOrderLineId: TRANSFER_LINE_ID,
        transferOrderId: TRANSFER_ID,
        productId: PROD_ID,
        quantity: '10',
      });
    });

    it('should throw NotFoundException if transfer does not exist', async () => {
      await expect(
        service.changeTransferState(
          '00000000-0000-4000-8000-000000000999',
          TRANSFER_ORDER_STATE.CONFIRMED,
          'admin',
          pg.db,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for invalid state transition', async () => {
      // draft -> shipped is invalid
      await expect(
        service.changeTransferState(
          TRANSFER_ID,
          TRANSFER_ORDER_STATE.SHIPPED,
          'admin',
          pg.db,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should successfully transition from confirmed to picking', async () => {
      await service.changeTransferState(
        TRANSFER_ID,
        TRANSFER_ORDER_STATE.PICKING,
        'admin',
        pg.db,
      );

      const [order] = await pg.db
        .select()
        .from(transferOrders)
        .where(eq(transferOrders.transferOrderId, TRANSFER_ID));
      expect(order.stateCode).toBe(TRANSFER_ORDER_STATE.PICKING);

      const events = await pg.db
        .select()
        .from(warehouseEvents)
        .where(eq(warehouseEvents.entityId, TRANSFER_ID));
      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe('status_changed');
      expect(events[0].payload).toEqual({
        entity: 'transfer_order',
        entityId: TRANSFER_ID,
        from: TRANSFER_ORDER_STATE.CONFIRMED,
        to: TRANSFER_ORDER_STATE.PICKING,
      });
    });

    it('should successfully transition from confirmed to cancelled', async () => {
      await pg.db
        .update(transferOrders)
        .set({ stateCode: TRANSFER_ORDER_STATE.CONFIRMED })
        .where(eq(transferOrders.transferOrderId, TRANSFER_ID));

      await service.changeTransferState(
        TRANSFER_ID,
        TRANSFER_ORDER_STATE.CANCELLED,
        'admin',
        pg.db,
      );

      const [order] = await pg.db
        .select()
        .from(transferOrders)
        .where(eq(transferOrders.transferOrderId, TRANSFER_ID));
      expect(order.stateCode).toBe(TRANSFER_ORDER_STATE.CANCELLED);
    });
  });

  describe('picking summary and picking for project return', () => {
    const CUST_ID = '00000000-0000-4000-8000-000000000089';
    const PROJECT_ID = '00000000-0000-4000-8000-000000000088';
    const ZONE_STG_ID = '00000000-0000-4000-8000-000000000076';
    const STAGING_BIN_ID = '00000000-0000-4000-8000-000000000077';
    const RET_TRANSFER_ID = '00000000-0000-4000-8000-000000000084';
    const RET_LINE_ID = '00000000-0000-4000-8000-000000000083';

    let transitBinId: string;
    let shippingBinId: string;

    beforeEach(async () => {
      await pg.db.insert(customers).values({
        customerId: CUST_ID,
        customerNumber: 'CUST-001',
        currencyCode: 'AUD',
        stateCode: CUSTOMER_STATE.ACTIVE,
        source: 'app',
        createdBy: 'system',
      });

      await pg.db.insert(zones).values({
        zoneId: ZONE_STG_ID,
        locationId: LOCATION_SRC_ID,
        code: 'STG-Z',
        name: 'Staging Zone',
        source: 'app',
        createdBy: 'system',
      });

      await pg.db.insert(bins).values([
        {
          binId: STAGING_BIN_ID,
          binNumber: 'STG-BIN-01',
          zoneId: ZONE_STG_ID,
          binType: BIN_TYPE.PROJECT,
          source: 'app',
          createdBy: 'system',
        },
      ]);

      const allBins = await pg.db
        .select({
          binId: bins.binId,
          binNumber: bins.binNumber,
          locationId: zones.locationId,
        })
        .from(bins)
        .innerJoin(zones, eq(bins.zoneId, zones.zoneId));

      shippingBinId = allBins.find(
        (b) => b.locationId === LOCATION_SRC_ID && b.binNumber === 'SHIPPING',
      )!.binId;
      transitBinId = allBins.find(
        (b) =>
          b.locationId === LOCATION_SRC_ID && b.binNumber === 'INTRA_TRANSIT',
      )!.binId;

      await pg.db.insert(projects).values({
        projectId: PROJECT_ID,
        projectNumber: 'PRJ-2026-001',
        name: 'Commercial Fitout',
        customerId: CUST_ID,
        stateCode: PROJECT_STATE.ACTIVE,
        billingType: PROJECT_BILLING_TYPE.TIME_AND_MATERIALS,
        currencyCode: 'AUD',
        stagingBinId: STAGING_BIN_ID,
        createdBy: 'system',
      });
    });

    it('should get picking summary and allow picking from project staging bin for return TO', async () => {
      await pg.db.insert(binContents).values({
        binId: STAGING_BIN_ID,
        productId: PROD_ID,
        actualQuantity: '15',
      });

      await pg.db.insert(transferOrders).values({
        transferOrderId: RET_TRANSFER_ID,
        orderNumber: 'TO-RET-01',
        sourceLocationId: LOCATION_SRC_ID,
        destinationLocationId: LOCATION_DST_ID,
        projectId: PROJECT_ID,
        isProjectReturn: true,
        stateCode: TRANSFER_ORDER_STATE.CONFIRMED,
        createdBy: 'system',
      });

      await pg.db.insert(transferOrderLines).values({
        transferOrderLineId: RET_LINE_ID,
        transferOrderId: RET_TRANSFER_ID,
        productId: PROD_ID,
        quantity: '5',
      });

      const summary = await service.getPickingSummary(RET_TRANSFER_ID);
      expect(summary.lines).toHaveLength(1);
      expect(summary.lines[0].availableBins).toHaveLength(1);
      expect(summary.lines[0].availableBins[0].binId).toBe(STAGING_BIN_ID);
      expect(summary.lines[0].availableBins[0].binName).toBe('STG-BIN-01');

      // Attempting to pick from an invalid bin should throw BadRequestException
      await expect(
        service.pickLine(
          RET_TRANSFER_ID,
          RET_LINE_ID,
          '00000000-0000-4000-8000-000000000099',
          5,
          'picker-user',
        ),
      ).rejects.toThrow(
        'Project return must be picked from the project staging bin',
      );

      const recordMovementSpy = jest.spyOn(
        inventoryMovementService,
        'recordInventoryMovement',
      );

      // Now pick from the staging bin
      const pickRes = await service.pickLine(
        RET_TRANSFER_ID,
        RET_LINE_ID,
        STAGING_BIN_ID,
        5,
        'picker-user',
      );
      expect(pickRes.success).toBe(true);

      expect(recordMovementSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          sourceType: 'TO_PICK',
          sourceId: RET_TRANSFER_ID,
          lines: [
            {
              productId: PROD_ID,
              binId: STAGING_BIN_ID,
              quantity: -5,
              uomCode: 'EA',
            },
            {
              productId: PROD_ID,
              binId: shippingBinId,
              quantity: 5,
              uomCode: 'EA',
            },
          ],
        }),
      );

      const afterSummary = await service.getPickingSummary(RET_TRANSFER_ID);
      expect(afterSummary.lines[0].quantityPicked).toBe('5');
      expect(afterSummary.lines[0].isFullyPicked).toBe(true);

      // Now test cancelPick
      const pickId = afterSummary.picks[0].pickId;
      await service.cancelPick(RET_TRANSFER_ID, pickId, 'admin');

      expect(recordMovementSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          sourceType: 'TO_PICK',
          sourceId: RET_TRANSFER_ID,
          lines: [
            {
              productId: PROD_ID,
              binId: shippingBinId,
              quantity: -5,
              uomCode: 'EA',
            },
            {
              productId: PROD_ID,
              binId: STAGING_BIN_ID,
              quantity: 5,
              uomCode: 'EA',
            },
          ],
        }),
      );
    });

    it('should fallback to line quantity when staging bin has no pre-existing binContents row and ship cleanly', async () => {
      const PROD_2_ID = '00000000-0000-4000-8000-000000000005';
      await pg.db.insert(products).values({
        productId: PROD_2_ID,
        productNumber: 'PROD-2',
        name: 'Test Product 2',
        productType: 'inventory',
        structureType: 'standard',
        baseUom: 'EA',
        stateCode: PRODUCT_STATE.ACTIVE,
        salesTaxCategoryId: '00000000-0000-4000-8000-000000000000',
        purchaseTaxCategoryId: '00000000-0000-4000-8000-000000000000',
        source: 'app',
        createdBy: 'system',
      });

      const RET_2_TRANSFER_ID = '00000000-0000-4000-8000-000000000082';
      const RET_2_LINE_ID = '00000000-0000-4000-8000-000000000081';

      await pg.db.insert(transferOrders).values({
        transferOrderId: RET_2_TRANSFER_ID,
        orderNumber: 'TO-RET-02',
        sourceLocationId: LOCATION_SRC_ID,
        destinationLocationId: LOCATION_DST_ID,
        projectId: PROJECT_ID,
        isProjectReturn: true,
        stateCode: TRANSFER_ORDER_STATE.CONFIRMED,
        createdBy: 'system',
      });

      await pg.db.insert(transferOrderLines).values({
        transferOrderLineId: RET_2_LINE_ID,
        transferOrderId: RET_2_TRANSFER_ID,
        productId: PROD_2_ID,
        quantity: '3',
      });

      const summary = await service.getPickingSummary(RET_2_TRANSFER_ID);
      expect(summary.lines).toHaveLength(1);
      expect(summary.lines[0].availableBins).toHaveLength(1);
      expect(summary.lines[0].availableBins[0].binId).toBe(STAGING_BIN_ID);
      expect(summary.lines[0].availableBins[0].onHand).toBe('3');

      const recordMovementSpy = jest.spyOn(
        inventoryMovementService,
        'recordInventoryMovement',
      );

      const pickRes = await service.pickLine(
        RET_2_TRANSFER_ID,
        RET_2_LINE_ID,
        STAGING_BIN_ID,
        3,
        'picker-user',
      );
      expect(pickRes.success).toBe(true);

      // Verify createShipment pulls from SHIPPING staging bin
      const shipment = await service.createShipment(
        RET_2_TRANSFER_ID,
        {
          lines: [
            {
              salesOrderLineId: RET_2_LINE_ID,
              quantityShipped: '3',
            },
          ],
        },
        'shipper-user',
      );
      expect(shipment.shipmentNumber).toBeDefined();

      expect(recordMovementSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          sourceType: 'TO_DISPATCH',
          sourceId: RET_2_TRANSFER_ID,
          lines: [
            {
              productId: PROD_2_ID,
              binId: shippingBinId,
              quantity: -3,
              uomCode: 'EA',
            },
            {
              productId: PROD_2_ID,
              binId: transitBinId,
              quantity: 3,
              uomCode: 'EA',
            },
          ],
        }),
      );

      const [updatedOrder] = await pg.db
        .select()
        .from(transferOrders)
        .where(eq(transferOrders.transferOrderId, RET_2_TRANSFER_ID));
      expect(updatedOrder.stateCode).toBe(TRANSFER_ORDER_STATE.SHIPPED);

      // Test cancelShipment reverses from INTRA_TRANSIT to SHIPPING
      await service.cancelShipment(
        RET_2_TRANSFER_ID,
        shipment.shipmentId,
        'shipper-user',
      );

      expect(recordMovementSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          sourceType: 'TRANSFER_OUT',
          sourceId: shipment.shipmentId,
          lines: [
            {
              productId: PROD_2_ID,
              binId: transitBinId,
              quantity: -3,
              uomCode: 'EA',
            },
            {
              productId: PROD_2_ID,
              binId: shippingBinId,
              quantity: 3,
              uomCode: 'EA',
            },
          ],
        }),
      );
    });

    it('should shipTransferOrder cleanly for a project return TO with 0 pre-existing binContents', async () => {
      const PROD_3_ID = '00000000-0000-4000-8000-000000000006';
      await pg.db.insert(products).values({
        productId: PROD_3_ID,
        productNumber: 'PROD-3',
        name: 'Test Product 3',
        productType: 'inventory',
        structureType: 'standard',
        baseUom: 'EA',
        stateCode: PRODUCT_STATE.ACTIVE,
        salesTaxCategoryId: '00000000-0000-4000-8000-000000000000',
        purchaseTaxCategoryId: '00000000-0000-4000-8000-000000000000',
        source: 'app',
        createdBy: 'system',
      });

      const RET_3_TRANSFER_ID = '00000000-0000-4000-8000-000000000092';
      const RET_3_LINE_ID = '00000000-0000-4000-8000-000000000091';

      await pg.db.insert(transferOrders).values({
        transferOrderId: RET_3_TRANSFER_ID,
        orderNumber: 'TO-RET-03',
        sourceLocationId: LOCATION_SRC_ID,
        destinationLocationId: LOCATION_DST_ID,
        projectId: PROJECT_ID,
        isProjectReturn: true,
        stateCode: TRANSFER_ORDER_STATE.CONFIRMED,
        createdBy: 'system',
      });

      await pg.db.insert(transferOrderLines).values({
        transferOrderLineId: RET_3_LINE_ID,
        transferOrderId: RET_3_TRANSFER_ID,
        productId: PROD_3_ID,
        quantity: '2',
      });

      const recordMovementSpy = jest.spyOn(
        inventoryMovementService,
        'recordInventoryMovement',
      );

      await service.pickLine(
        RET_3_TRANSFER_ID,
        RET_3_LINE_ID,
        STAGING_BIN_ID,
        2,
        'picker-user',
      );

      const shipRes = await service.shipTransferOrder(
        RET_3_TRANSFER_ID,
        'shipper-user',
      );
      expect(shipRes.shipmentNumber).toBeDefined();

      expect(recordMovementSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          sourceType: 'TRANSFER_OUT',
          lines: [
            {
              productId: PROD_3_ID,
              binId: shippingBinId,
              quantity: -2,
              uomCode: 'EA',
            },
            {
              productId: PROD_3_ID,
              binId: transitBinId,
              quantity: 2,
              uomCode: 'EA',
            },
          ],
        }),
      );

      const [updatedOrder] = await pg.db
        .select()
        .from(transferOrders)
        .where(eq(transferOrders.transferOrderId, RET_3_TRANSFER_ID));
      expect(updatedOrder.stateCode).toBe(TRANSFER_ORDER_STATE.SHIPPED);
    });

    it('should exclude project staging bins from standard transfer orders picking summary', async () => {
      const STORAGE_BIN_ID = '00000000-0000-4000-8000-000000000078';
      await pg.db.insert(bins).values({
        binId: STORAGE_BIN_ID,
        binNumber: 'STOR-BIN-01',
        zoneId: ZONE_STG_ID,
        binType: 'storage',
        isUnavailable: false,
        isBonded: false,
        source: 'app',
        createdBy: 'system',
      });
      await pg.db.insert(binContents).values({
        binId: STORAGE_BIN_ID,
        productId: PROD_ID,
        actualQuantity: '20',
      });
      await pg.db.insert(binContents).values({
        binId: STAGING_BIN_ID,
        productId: PROD_ID,
        actualQuantity: '10',
      });

      const STD_TRANSFER_ID = '00000000-0000-4000-8000-000000000095';
      const STD_LINE_ID = '00000000-0000-4000-8000-000000000094';

      await pg.db.insert(transferOrders).values({
        transferOrderId: STD_TRANSFER_ID,
        orderNumber: 'TO-STD-01',
        sourceLocationId: LOCATION_SRC_ID,
        destinationLocationId: LOCATION_DST_ID,
        isProjectReturn: false,
        stateCode: TRANSFER_ORDER_STATE.CONFIRMED,
        createdBy: 'system',
      });
      await pg.db.insert(transferOrderLines).values({
        transferOrderLineId: STD_LINE_ID,
        transferOrderId: STD_TRANSFER_ID,
        productId: PROD_ID,
        quantity: '5',
      });

      const summary = await service.getPickingSummary(STD_TRANSFER_ID);
      expect(summary.lines).toHaveLength(1);
      const binIds = summary.lines[0].availableBins.map((b) => b.binId);
      expect(binIds).toContain(STORAGE_BIN_ID);
      expect(binIds).not.toContain(STAGING_BIN_ID);
    });
  });

  describe('receiveTransferOrder shipment state transitions', () => {
    const SHIPMENT_ID = '00000000-0000-4000-8000-000000000070';

    beforeEach(async () => {
      await pg.db.insert(transferOrders).values({
        transferOrderId: TRANSFER_ID,
        orderNumber: 'TO-RECV-01',
        sourceLocationId: LOCATION_SRC_ID,
        destinationLocationId: LOCATION_DST_ID,
        isProjectReturn: false,
        stateCode: TRANSFER_ORDER_STATE.SHIPPED,
        createdBy: 'system',
      });
      await pg.db.insert(transferOrderLines).values({
        transferOrderLineId: TRANSFER_LINE_ID,
        transferOrderId: TRANSFER_ID,
        productId: PROD_ID,
        quantity: '10',
        quantityShipped: '10',
        quantityReceived: '0',
      });
      await pg.db.insert(transferOrderShipments).values({
        shipmentId: SHIPMENT_ID,
        transferOrderId: TRANSFER_ID,
        shipmentNumber: 'TSHIP-001',
        stateCode: SHIPMENT_STATE.DISPATCHED,
        shippedBy: 'admin',
      });
    });

    it('transitions shipment to partially_received when partially received and creates pending putaway receipt lines', async () => {
      await service.receiveTransferOrder(
        TRANSFER_ID,
        [{ transferOrderLineId: TRANSFER_LINE_ID, quantityReceived: '4' }],
        'admin',
      );

      const [shipment] = await pg.db
        .select()
        .from(transferOrderShipments)
        .where(eq(transferOrderShipments.shipmentId, SHIPMENT_ID));

      expect(shipment.stateCode).toBe(SHIPMENT_STATE.PARTIALLY_RECEIVED);

      const [to] = await pg.db
        .select()
        .from(transferOrders)
        .where(eq(transferOrders.transferOrderId, TRANSFER_ID));
      expect(to.stateCode).toBe(TRANSFER_ORDER_STATE.PARTIALLY_RECEIVED);

      const receiptLines = await pg.db.select().from(transferOrderReceiptLines);
      expect(receiptLines).toHaveLength(1);
      expect(receiptLines[0].putawayStatus).toBe(
        PUTAWAY_STATUS.PENDING_PUTAWAY,
      );
      expect(receiptLines[0].quantity).toBe('4');
    });

    it('transitions shipment to received when fully received and sets pending putaway', async () => {
      await service.receiveTransferOrder(
        TRANSFER_ID,
        [{ transferOrderLineId: TRANSFER_LINE_ID, quantityReceived: '10' }],
        'admin',
      );

      const [shipment] = await pg.db
        .select()
        .from(transferOrderShipments)
        .where(eq(transferOrderShipments.shipmentId, SHIPMENT_ID));

      expect(shipment.stateCode).toBe(SHIPMENT_STATE.RECEIVED);

      const [to] = await pg.db
        .select()
        .from(transferOrders)
        .where(eq(transferOrders.transferOrderId, TRANSFER_ID));
      expect(to.stateCode).toBe(TRANSFER_ORDER_STATE.RECEIVED);

      const receiptLines = await pg.db.select().from(transferOrderReceiptLines);
      expect(receiptLines).toHaveLength(1);
      expect(receiptLines[0].putawayStatus).toBe(
        PUTAWAY_STATUS.PENDING_PUTAWAY,
      );
      expect(receiptLines[0].quantity).toBe('10');
    });
  });
});
