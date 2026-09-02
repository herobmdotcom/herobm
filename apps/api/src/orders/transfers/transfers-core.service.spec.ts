import { Test, TestingModule } from '@nestjs/testing';
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
} from '@herobm/db-schema';
import { EntityType } from '../../common/event-types';
import { eq } from 'drizzle-orm';
import {
  TRANSFER_ORDER_STATE,
  PRODUCT_STATE,
  SHIPMENT_STATE,
} from '@herobm/shared';

describe('TransfersCoreService', () => {
  const pg = setupPgliteSuite({ skipSeeds: true });
  let service: TransfersCoreService;

  const LOCATION_SRC_ID = '00000000-0000-4000-8000-000000000001';
  const LOCATION_DST_ID = '00000000-0000-4000-8000-000000000002';
  const PROD_ID = '00000000-0000-4000-8000-000000000003';
  const TRANSFER_ID = '00000000-0000-4000-8000-000000000004';

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
        name: 'Source Location',
        source: 'app',
        createdBy: 'system',
      },
      {
        locationId: LOCATION_DST_ID,
        code: 'DST',
        name: 'Destination Location',
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
        TransfersCoreService,
        {
          provide: DRIZZLE,
          useValue: pg.db,
        },
      ],
    }).compile();

    service = module.get<TransfersCoreService>(TransfersCoreService);
  });

  describe('generate numbers', () => {
    it('should generate first transfer number correctly', async () => {
      const num = await service.generateTransferNumber(pg.db);
      expect(num).toMatch(/^TO-\d{8}-001$/);
    });

    it('should generate subsequent transfer number correctly', async () => {
      const prefix = `TO-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-`;
      await pg.db.insert(transferOrders).values({
        transferOrderId: TRANSFER_ID,
        orderNumber: `${prefix}005`,
        sourceLocationId: LOCATION_SRC_ID,
        destinationLocationId: LOCATION_DST_ID,
        stateCode: TRANSFER_ORDER_STATE.CONFIRMED,
        createdBy: 'system',
      });

      const num = await service.generateTransferNumber(pg.db);
      expect(num).toBe(`${prefix}006`);
    });

    it('should generate shipment number correctly', async () => {
      const num = await service.generateShipmentNumber(pg.db);
      expect(num).toMatch(/^TSH-\d{8}-001$/);
    });

    it('should generate receipt number correctly', async () => {
      const num = await service.generateReceiptNumber(pg.db);
      expect(num).toMatch(/^TRC-\d{8}-001$/);
    });
  });

  describe('findOne', () => {
    it('should throw NotFoundException if transfer does not exist', async () => {
      await expect(
        service.findOne('00000000-0000-4000-8000-000000000999'),
      ).rejects.toThrow('Transfer Order not found');
    });

    it('should return transfer with its lines and events', async () => {
      await pg.db.insert(transferOrders).values({
        transferOrderId: TRANSFER_ID,
        orderNumber: 'TO-123',
        sourceLocationId: LOCATION_SRC_ID,
        destinationLocationId: LOCATION_DST_ID,
        stateCode: TRANSFER_ORDER_STATE.CONFIRMED,
        createdBy: 'system',
      });

      await pg.db.insert(transferOrderLines).values({
        transferOrderLineId: '00000000-0000-4000-8000-000000000010',
        transferOrderId: TRANSFER_ID,
        productId: PROD_ID,
        quantity: '10',
      });

      await pg.db.insert(warehouseEvents).values({
        eventId: '00000000-0000-4000-8000-000000000020',
        entityType: EntityType.TRANSFER_ORDER,
        entityId: TRANSFER_ID,
        eventType: 'CREATED',
        payload: { test: true },
        actor: 'admin',
      });

      const result = await service.findOne(TRANSFER_ID);
      expect(result.id).toBe(TRANSFER_ID);
      expect(result.sourceLocationId).toBe(LOCATION_SRC_ID);
      expect(result.lines).toHaveLength(1);
      expect(result.lines[0].quantity).toBe('10');
      expect(result.events).toHaveLength(1);
      expect(result.events[0].eventType).toBe('CREATED');
    });
  });

  describe('findAll', () => {
    it('should return paginated list of transfers', async () => {
      await pg.db.insert(transferOrders).values([
        {
          transferOrderId: '00000000-0000-4000-8000-000000000011',
          orderNumber: 'TO-FIND-1',
          sourceLocationId: LOCATION_SRC_ID,
          destinationLocationId: LOCATION_DST_ID,
          stateCode: TRANSFER_ORDER_STATE.CONFIRMED,
          createdBy: 'system',
        },
        {
          transferOrderId: '00000000-0000-4000-8000-000000000012',
          orderNumber: 'TO-FIND-2',
          sourceLocationId: LOCATION_SRC_ID,
          destinationLocationId: LOCATION_DST_ID,
          stateCode: TRANSFER_ORDER_STATE.SHIPPED,
          createdBy: 'system',
        },
      ]);

      const result = await service.findAll({ limit: 10 });
      expect(result.total).toBeGreaterThanOrEqual(2);
      expect(result.data.length).toBeGreaterThanOrEqual(2);
      expect(result.data.map((d) => d.orderNumber)).toContain('TO-FIND-1');
      expect(result.data.map((d) => d.orderNumber)).toContain('TO-FIND-2');
    });

    it('should filter transfers by stateCode', async () => {
      const result = await service.findAll({
        limit: 10,
        state: TRANSFER_ORDER_STATE.SHIPPED,
      });
      expect(
        result.data.every((d) => d.stateCode === TRANSFER_ORDER_STATE.SHIPPED),
      ).toBe(true);
    });
  });

  describe('findShipments', () => {
    it('should return empty array if no shipments exist', async () => {
      const shipments = await service.findShipments(TRANSFER_ID);
      expect(shipments).toEqual([]);
    });

    it('should return shipments with lines', async () => {
      await pg.db.insert(transferOrders).values({
        transferOrderId: TRANSFER_ID,
        orderNumber: 'TO-123',
        sourceLocationId: LOCATION_SRC_ID,
        destinationLocationId: LOCATION_DST_ID,
        stateCode: TRANSFER_ORDER_STATE.CONFIRMED,
        createdBy: 'system',
      });
      await pg.db.insert(transferOrderShipments).values({
        shipmentId: '00000000-0000-4000-8000-000000000030',
        transferOrderId: TRANSFER_ID,
        shipmentNumber: 'TSH-123',
        stateCode: SHIPMENT_STATE.DISPATCHED,
        shippedBy: 'user',
      });

      const shipments = await service.findShipments(TRANSFER_ID);
      expect(shipments).toHaveLength(1);
      expect(shipments[0].shipmentNumber).toBe('TSH-123');
      expect(shipments[0].lines).toBeDefined();
    });
  });
});
