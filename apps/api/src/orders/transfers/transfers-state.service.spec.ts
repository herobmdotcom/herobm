import { Test, TestingModule } from '@nestjs/testing';
import { TransfersStateService } from './transfers-state.service';
import { TransfersCoreService } from './transfers-core.service';
import { InventoryMovementService } from '../../inventory/inventory-movement.service';
import { DRIZZLE } from '../../drizzle/drizzle.module';
import { setupPgliteSuite } from '../../test-utils/pglite-suite';
import {
  transferOrders,
  locations,
  products,
  transferOrderLines,
  transferOrderShipments,
  warehouseEvents,
  uomDictionary,
  taxCategories,
  zones,
  bins,
} from '@herobm/db-schema';
import { eq } from 'drizzle-orm';
import {
  TRANSFER_ORDER_STATE,
  PRODUCT_STATE,
  SHIPMENT_STATE,
} from '@herobm/shared';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('TransfersStateService', () => {
  const pg = setupPgliteSuite({ skipSeeds: true });
  let service: TransfersStateService;

  const LOCATION_SRC_ID = '00000000-0000-4000-8000-000000000001';
  const LOCATION_DST_ID = '00000000-0000-4000-8000-000000000002';
  const PROD_ID = '00000000-0000-4000-8000-000000000003';
  const TRANSFER_ID = '00000000-0000-4000-8000-000000000004';
  const TRANSFER_LINE_ID = '00000000-0000-4000-8000-000000000010';

  beforeEach(async () => {
    await pg.db
      .insert(uomDictionary)
      .values({ uomCode: 'EA', description: 'Each' });
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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransfersStateService,
        TransfersCoreService,
        {
          provide: InventoryMovementService,
          useValue: {
            reserveStockForTransferOrder: jest.fn().mockResolvedValue([]),
            unreserveStockForTransferOrder: jest.fn().mockResolvedValue([]),
            shipTransferOrderStock: jest.fn().mockResolvedValue([]),
            receiveTransferOrderStock: jest.fn().mockResolvedValue([]),
            recordInventoryMovement: jest.fn().mockResolvedValue({}),
          },
        },
        {
          provide: DRIZZLE,
          useValue: pg.db,
        },
      ],
    }).compile();

    service = module.get<TransfersStateService>(TransfersStateService);
  });

  describe('updateState', () => {
    beforeEach(async () => {
      await pg.db.insert(transferOrders).values({
        transferOrderId: TRANSFER_ID,
        orderNumber: 'TO-123',
        sourceLocationId: LOCATION_SRC_ID,
        destinationLocationId: LOCATION_DST_ID,
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

  describe('picking summary', () => {
    it('should get picking summary for a transfer order', async () => {
      await pg.db.insert(transferOrders).values({
        transferOrderId: TRANSFER_ID,
        orderNumber: 'TO-123',
        sourceLocationId: LOCATION_SRC_ID,
        destinationLocationId: LOCATION_DST_ID,
        stateCode: TRANSFER_ORDER_STATE.CONFIRMED,
        createdBy: 'system',
      });
      await pg.db.insert(transferOrderLines).values({
        transferOrderLineId: TRANSFER_LINE_ID,
        transferOrderId: TRANSFER_ID,
        productId: PROD_ID,
        quantity: '10',
      });

      const summary = await service.getPickingSummary(TRANSFER_ID);
      expect(summary.lines).toHaveLength(1);
      expect(summary.picks).toEqual([]);
    });
  });

  describe('receiveTransferOrder shipment state transitions', () => {
    const ZONE_SRC_ID = '00000000-0000-4000-8000-000000000050';
    const ZONE_DST_ID = '00000000-0000-4000-8000-000000000051';
    const BIN_TRANSIT_ID = '00000000-0000-4000-8000-000000000060';
    const BIN_RECV_ID = '00000000-0000-4000-8000-000000000061';
    const SHIPMENT_ID = '00000000-0000-4000-8000-000000000070';

    beforeEach(async () => {
      await pg.db.insert(zones).values([
        {
          zoneId: ZONE_SRC_ID,
          locationId: LOCATION_SRC_ID,
          code: 'Z-SRC',
          name: 'Zone Src',
          source: 'app',
          createdBy: 'system',
        },
        {
          zoneId: ZONE_DST_ID,
          locationId: LOCATION_DST_ID,
          code: 'Z-DST',
          name: 'Zone Dst',
          source: 'app',
          createdBy: 'system',
        },
      ]);
      await pg.db.insert(bins).values([
        {
          binId: BIN_TRANSIT_ID,
          zoneId: ZONE_SRC_ID,
          binNumber: 'INTRA_TRANSIT',
          binType: 'staging',
          source: 'app',
          createdBy: 'system',
        },
        {
          binId: BIN_RECV_ID,
          zoneId: ZONE_DST_ID,
          binNumber: 'RECEIVING',
          binType: 'staging',
          source: 'app',
          createdBy: 'system',
        },
      ]);
      await pg.db.insert(transferOrders).values({
        transferOrderId: TRANSFER_ID,
        orderNumber: 'TO-RECV-01',
        sourceLocationId: LOCATION_SRC_ID,
        destinationLocationId: LOCATION_DST_ID,
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

    it('transitions shipment to partially_received when partially received', async () => {
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
    });

    it('transitions shipment to received when fully received', async () => {
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
    });
  });
});
