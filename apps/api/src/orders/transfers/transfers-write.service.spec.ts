import { Test, TestingModule } from '@nestjs/testing';
import { TransfersWriteService } from './transfers-write.service';
import { TransfersCoreService } from './transfers-core.service';
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
  backorders,
  salesOrders,
  salesOrderLineItems,
  customers,
} from '@herobm/db-schema';
import { EntityType, EventType } from '../../common/event-types';
import { eq, desc } from 'drizzle-orm';
import {
  TRANSFER_ORDER_STATE,
  BACKORDER_STATE,
  PRODUCT_STATE,
  SALES_ORDER_STATE,
  CUSTOMER_STATE,
} from '@herobm/shared';

describe('TransfersWriteService', () => {
  const pg = setupPgliteSuite({ skipSeeds: true });
  let service: TransfersWriteService;
  let coreService: TransfersCoreService;

  const LOCATION_SRC_ID = '00000000-0000-4000-8000-000000000001';
  const LOCATION_DST_ID = '00000000-0000-4000-8000-000000000002';
  const PROD_ID = '00000000-0000-4000-8000-000000000003';
  const SALES_ORDER_ID = '00000000-0000-4000-8000-000000000004';
  const SALES_ORDER_LINE_ID = '00000000-0000-4000-8000-000000000005';
  const BACKORDER_ID = '00000000-0000-4000-8000-000000000006';

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
        TransfersWriteService,
        TransfersCoreService,
        {
          provide: DRIZZLE,
          useValue: pg.db,
        },
      ],
    }).compile();

    service = module.get<TransfersWriteService>(TransfersWriteService);
    coreService = module.get<TransfersCoreService>(TransfersCoreService);
  });

  describe('createTransferFromDemands', () => {
    it('should throw if no demands specified', async () => {
      await expect(
        service.createTransferFromDemands(LOCATION_SRC_ID, [], 'admin'),
      ).rejects.toThrow('No demands specified');
    });

    it('should create transfer order from backorders and update backorder state', async () => {
      // Setup sales order and backorder
      await pg.db.insert(customers).values({
        customerId: '00000000-0000-4000-8000-000000000000',
        customerNumber: 'C-001',
        currencyCode: 'AUD',
        stateCode: CUSTOMER_STATE.ACTIVE,
        source: 'app',
        createdBy: 'system',
      });
      await pg.db.insert(salesOrders).values({
        salesOrderId: SALES_ORDER_ID,
        orderNumber: 'SO-123',
        customerId: '00000000-0000-4000-8000-000000000000',
        fulfillmentLocationId: LOCATION_SRC_ID,
        currencyCode: 'AUD',
        exchangeRate: '1',
        discrepanciesAcknowledged: false,
        stateCode: SALES_ORDER_STATE.CONFIRMED,
        source: 'app',
        createdBy: 'system',
      });

      await pg.db.insert(salesOrderLineItems).values({
        salesOrderLineId: SALES_ORDER_LINE_ID,
        salesOrderId: SALES_ORDER_ID,
        lineNumber: 1,
        productId: PROD_ID,
        quantity: '5',
        pricePerUnit: '10',
        amount: '50',
        taxCategoryId: '00000000-0000-4000-8000-000000000000',
        tax: '5',
        totalAmount: '55',
        unitOfMeasure: 'EA',
        fulfillmentLocationId: LOCATION_DST_ID,
      });

      await pg.db.insert(backorders).values({
        backorderId: BACKORDER_ID,
        productId: PROD_ID,
        salesOrderId: SALES_ORDER_ID,
        salesOrderLineId: SALES_ORDER_LINE_ID,
        quantity: '5',
        stateCode: BACKORDER_STATE.PENDING_SUPPLY,
      });

      const result = await service.createTransferFromDemands(
        LOCATION_SRC_ID,
        [BACKORDER_ID],
        'admin',
      );

      expect(result.transferOrderId).toBeDefined();
      expect(result.orderNumber).toMatch(/^TO-/);

      // Verify DB state
      const [order] = await pg.db
        .select()
        .from(transferOrders)
        .where(eq(transferOrders.transferOrderId, result.transferOrderId));
      expect(order.sourceLocationId).toBe(LOCATION_SRC_ID);
      expect(order.destinationLocationId).toBe(LOCATION_DST_ID);
      expect(order.stateCode).toBe(TRANSFER_ORDER_STATE.CONFIRMED);

      const lines = await pg.db
        .select()
        .from(transferOrderLines)
        .where(eq(transferOrderLines.transferOrderId, result.transferOrderId));
      expect(lines).toHaveLength(1);
      expect(lines[0].productId).toBe(PROD_ID);
      expect(lines[0].quantity).toBe('5');

      const [bo] = await pg.db
        .select()
        .from(backorders)
        .where(eq(backorders.backorderId, BACKORDER_ID));
      expect(bo.stateCode).toBe(BACKORDER_STATE.AWAITING_RECEIPT);
      expect(bo.transferOrderId).toBe(result.transferOrderId);

      const events = await pg.db
        .select()
        .from(warehouseEvents)
        .where(eq(warehouseEvents.entityId, result.transferOrderId));
      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe(EventType.CREATED);
    });
  });

  describe('create', () => {
    it('should create a transfer order with lines', async () => {
      const result = await service.create(
        {
          sourceLocationId: LOCATION_SRC_ID,
          destinationLocationId: LOCATION_DST_ID,
          notes: 'test note',
          shippingNotes: 'ship note',
          lines: [{ productId: PROD_ID, quantity: '10' }],
        },
        'admin',
      );

      expect(result.transferOrderId).toBeDefined();

      const [order] = await pg.db
        .select()
        .from(transferOrders)
        .where(eq(transferOrders.transferOrderId, result.transferOrderId));
      expect(order.notes).toBe('test note');
      expect(order.shippingNotes).toBe('ship note');
      expect(order.stateCode).toBe(TRANSFER_ORDER_STATE.CONFIRMED);

      const lines = await pg.db
        .select()
        .from(transferOrderLines)
        .where(eq(transferOrderLines.transferOrderId, result.transferOrderId));
      expect(lines).toHaveLength(1);
      expect(lines[0].quantity).toBe('10');
    });
  });

  describe('update', () => {
    it('should update notes and locations if state is confirmed', async () => {
      const { transferOrderId } = await service.create(
        {
          sourceLocationId: LOCATION_SRC_ID,
          destinationLocationId: LOCATION_DST_ID,
          lines: [],
        },
        'admin',
      );

      await service.update(
        transferOrderId,
        {
          notes: 'new note',
          sourceLocationId: LOCATION_DST_ID, // Swap
        },
        'admin',
      );

      const [order] = await pg.db
        .select()
        .from(transferOrders)
        .where(eq(transferOrders.transferOrderId, transferOrderId));
      expect(order.notes).toBe('new note');
      expect(order.sourceLocationId).toBe(LOCATION_DST_ID);
    });

    it('should not allow location updates if not confirmed', async () => {
      const { transferOrderId } = await service.create(
        {
          sourceLocationId: LOCATION_SRC_ID,
          destinationLocationId: LOCATION_DST_ID,
          lines: [],
        },
        'admin',
      );

      await pg.db
        .update(transferOrders)
        .set({ stateCode: TRANSFER_ORDER_STATE.SHIPPED })
        .where(eq(transferOrders.transferOrderId, transferOrderId));

      await expect(
        service.update(
          transferOrderId,
          { sourceLocationId: LOCATION_DST_ID },
          'admin',
        ),
      ).rejects.toThrow(
        'Cannot edit locations on an order that is already in progress',
      );
    });
  });

  describe('lines management', () => {
    let transferId: string;
    let lineId: string;

    beforeEach(async () => {
      const res = await service.create(
        {
          sourceLocationId: LOCATION_SRC_ID,
          destinationLocationId: LOCATION_DST_ID,
          lines: [{ productId: PROD_ID, quantity: '2' }],
        },
        'admin',
      );
      transferId = res.transferOrderId;
      const lines = await pg.db
        .select()
        .from(transferOrderLines)
        .where(eq(transferOrderLines.transferOrderId, transferId));
      lineId = lines[0].transferOrderLineId;
    });

    it('should add a line', async () => {
      const { lineId: newLineId } = await service.addLine(
        transferId,
        { productId: PROD_ID, quantity: '5' },
        'admin',
      );

      const lines = await pg.db
        .select()
        .from(transferOrderLines)
        .where(eq(transferOrderLines.transferOrderLineId, newLineId));
      expect(lines).toHaveLength(1);
      expect(lines[0].quantity).toBe('5');
    });

    it('should update a line', async () => {
      await service.updateLine(transferId, lineId, { quantity: '7' }, 'admin');

      const lines = await pg.db
        .select()
        .from(transferOrderLines)
        .where(eq(transferOrderLines.transferOrderLineId, lineId));
      expect(lines[0].quantity).toBe('7');
    });

    it('should remove a line', async () => {
      await service.removeLine(transferId, lineId, 'admin');

      const lines = await pg.db
        .select()
        .from(transferOrderLines)
        .where(eq(transferOrderLines.transferOrderLineId, lineId));
      expect(lines).toHaveLength(0);
    });
  });
});
