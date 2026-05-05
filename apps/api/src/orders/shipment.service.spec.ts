import { AppConfigService } from '../settings/app-config.service';
import { Test, TestingModule } from '@nestjs/testing';
import { ShipmentService } from './shipment.service';
import { InventoryService } from '../inventory/inventory.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { setupPgliteSuite } from '../test-utils/pglite-suite';
import {
  salesOrders,
  salesOrderLineItems,
  salesOrderPicks,
  salesOrderShipments,
  salesOrderShipmentLines,
  inventoryBinEntries,
  products,
  bins,
  locations,
  uomDictionary,
  accounts,
  taxCategories,
} from '../drizzle/modbm-core-schema';
import { eq } from 'drizzle-orm';
import { setupTestModule } from '../../test/utils/test-module';

// Shared test data
const PICKING_ORDER = {
  salesOrderId: '00000000-0000-0000-0000-000000000001',
  orderNumber: 'ORD-20260316-0001',
  stateCode: 'picking',
  customerId: 'c0000000-0000-0000-0000-000000000001',
  fulfillmentLocationId: '10000000-0000-0000-0000-000000000001',
  currencyCode: 'AUD',
};

const ORDER_LINE = {
  salesOrderLineId: '00000000-0000-0000-0000-000000000002',
  salesOrderId: '00000000-0000-0000-0000-000000000001',
  lineNumber: 1,
  productId: 'a0000000-0000-0000-0000-000000000001',
  productDescription: 'Widget A',
  quantity: '10',
  pricePerUnit: '50.00',
  amount: '500.00',
  fulfillmentLocationId: '10000000-0000-0000-0000-000000000001', // Will update in beforeEach
  taxCategoryId: 'd0000000-0000-0000-0000-000000000001', // Will update in beforeEach
};

const MOCK_SHIPMENT = {
  shipmentId: 'e0000000-0000-0000-0000-000000000001',
  shipmentNumber: 'SHP-20260316-0001',
  salesOrderId: '00000000-0000-0000-0000-000000000001',
  stateCode: 'draft',
  notes: null,
  createdBy: 'admin',
};

const MOCK_SHIPMENT_LINE = {
  shipmentLineId: 'f0000000-0000-0000-0000-000000000001',
  shipmentId: 'e0000000-0000-0000-0000-000000000001',
  salesOrderLineId: '00000000-0000-0000-0000-000000000002',
  quantityShipped: '5',
};

describe('ShipmentService', () => {
  const pg = setupPgliteSuite();
  let service: ShipmentService;
  let mockInventoryService: any;

  beforeEach(async () => {
    mockInventoryService = {
      recordInventoryMovement: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await setupTestModule([
      ShipmentService,
      { provide: InventoryService, useValue: mockInventoryService },
    ])
      .overrideProvider(DRIZZLE)
      .useValue(pg.db)
      .compile();

    service = module.get<ShipmentService>(ShipmentService);

    // Clean only transactional tables
    await pg.client.exec(`
      TRUNCATE TABLE modbm_core.sales_order_shipment_lines CASCADE;
      TRUNCATE TABLE modbm_core.sales_order_shipments CASCADE;
      TRUNCATE TABLE modbm_core.sales_order_picks CASCADE;
      TRUNCATE TABLE modbm_core.sales_order_lines CASCADE;
      TRUNCATE TABLE modbm_core.sales_orders CASCADE;
      TRUNCATE TABLE modbm_core.products CASCADE;
    `);

    // Fetch dynamic IDs from standard seeds
    const stdTax = await pg.db.query.taxCategories.findFirst({
      where: eq(taxCategories.code, 'GST'),
    });
    if (stdTax) ORDER_LINE.taxCategoryId = stdTax.taxCategoryId;

    // Standard seeds do not include locations. Insert a default location.
    await pg.db
      .insert(locations)
      .values([
        {
          locationId: '10000000-0000-0000-0000-000000000001',
          code: 'MAIN',
          name: 'Main',
        },
      ])
      .onConflictDoNothing();
    ORDER_LINE.fulfillmentLocationId = '10000000-0000-0000-0000-000000000001';
    PICKING_ORDER.fulfillmentLocationId =
      '10000000-0000-0000-0000-000000000001';

    // Since accounts isn't seeded with customers by default, let's just insert one or use the org. Let's insert a customer.
    await pg.db
      .insert(accounts)
      .values([
        {
          accountId: 'c0000000-0000-0000-0000-000000000001',
          accountNumber: 'CUST-001',
          name: 'Test Customer',
          currencyCode: 'AUD',
        },
      ])
      .onConflictDoNothing();

    // Insert Default Mocks
    await pg.db.insert(products).values([
      {
        productId: 'a0000000-0000-0000-0000-000000000001',
        productNumber: 'PROD-001',
        name: 'Widget A',
        productType: 'inventory',
        baseUom: 'EA',
      },
    ]);
    await pg.db.insert(salesOrders).values([PICKING_ORDER]);
    await pg.db.insert(salesOrderLineItems).values([ORDER_LINE]);
    await pg.db.insert(salesOrderPicks).values([
      {
        salesOrderPickId: 'b0000000-0000-0000-0000-000000000001',
        salesOrderId: '00000000-0000-0000-0000-000000000001',
        salesOrderLineId: '00000000-0000-0000-0000-000000000002',
        productId: 'a0000000-0000-0000-0000-000000000001',
        quantity: '10',
        stateCode: 'picked',
      },
    ]);
    await pg.db.insert(salesOrderShipments).values([MOCK_SHIPMENT]);
    await pg.db.insert(salesOrderShipmentLines).values([MOCK_SHIPMENT_LINE]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // generateShipmentNumber
  // =========================================================================

  describe('generateShipmentNumber', () => {
    it('should generate first sequence number if none exist today', async () => {
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const num = await service.generateShipmentNumber();
      expect(num).toBe(`SHP-${today}-0001`);
    });

    it('should increment the latest sequence number', async () => {
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      await pg.db.insert(salesOrderShipments).values([
        {
          ...MOCK_SHIPMENT,
          shipmentId: '10000000-0000-0000-0000-000000000009',
          shipmentNumber: `SHP-${today}-0005`,
        },
      ]);

      const num = await service.generateShipmentNumber();
      expect(num).toBe(`SHP-${today}-0006`);
    });
  });

  // =========================================================================
  // createShipment
  // =========================================================================

  describe('createShipment', () => {
    it('should create a shipment when order is in picking state and qty is valid', async () => {
      // Default mock sets order in 'picking' state, line picked=10.
      const dto = {
        lines: [
          {
            salesOrderLineId: '00000000-0000-0000-0000-000000000002',
            quantityShipped: '5',
          },
        ],
      };
      const result = await service.createShipment(
        '00000000-0000-0000-0000-000000000001',
        dto,
        'admin',
      );

      expect(result).toBeDefined();
    });

    it('should reject if order is not in picking state', async () => {
      await pg.db
        .update(salesOrders)
        .set({ stateCode: 'draft' })
        .where(
          eq(salesOrders.salesOrderId, '00000000-0000-0000-0000-000000000001'),
        );
      const dto = {
        lines: [
          {
            salesOrderLineId: '00000000-0000-0000-0000-000000000002',
            quantityShipped: '5',
          },
        ],
      };
      await expect(
        service.createShipment(
          '00000000-0000-0000-0000-000000000001',
          dto,
          'admin',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject if shipped quantity is greater than available', async () => {
      // ORDER_LINE has quantityPicked=10. Requesting 15 should fail.
      const dto = {
        lines: [
          {
            salesOrderLineId: '00000000-0000-0000-0000-000000000002',
            quantityShipped: '15',
          },
        ],
      };
      await expect(
        service.createShipment(
          '00000000-0000-0000-0000-000000000001',
          dto,
          'admin',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // =========================================================================
  // updateShipment
  // =========================================================================

  describe('updateShipment', () => {
    it('should allow updating notes on a draft shipment', async () => {
      const result = await service.updateShipment(
        'e0000000-0000-0000-0000-000000000001',
        { notes: 'Updated notes' },
        'admin',
      );
      expect(result).toBeDefined();
    });

    it('should reject updating a cancelled shipment', async () => {
      await pg.db
        .update(salesOrderShipments)
        .set({ stateCode: 'cancelled' })
        .where(
          eq(
            salesOrderShipments.shipmentId,
            'e0000000-0000-0000-0000-000000000001',
          ),
        );
      await expect(
        service.updateShipment(
          'e0000000-0000-0000-0000-000000000001',
          { notes: 'Updated notes' },
          'admin',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // =========================================================================
  // addShipmentLine
  // =========================================================================

  describe('addShipmentLine', () => {
    it('should add a line to a draft shipment', async () => {
      // Default mocks have shipment in draft.
      const result = await service.addShipmentLine(
        'e0000000-0000-0000-0000-000000000001',
        {
          salesOrderLineId: '00000000-0000-0000-0000-000000000002',
          quantityShipped: '2',
        },
        'admin',
      );
      expect(result).toBeDefined();
    });

    it('should reject if shipment is not in draft', async () => {
      await pg.db
        .update(salesOrderShipments)
        .set({ stateCode: 'cancelled' })
        .where(
          eq(
            salesOrderShipments.shipmentId,
            'e0000000-0000-0000-0000-000000000001',
          ),
        );
      await expect(
        service.addShipmentLine(
          'e0000000-0000-0000-0000-000000000001',
          {
            salesOrderLineId: '00000000-0000-0000-0000-000000000002',
            quantityShipped: '2',
          },
          'admin',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // =========================================================================
  // updateShipmentLine
  // =========================================================================

  describe('updateShipmentLine', () => {
    it('should update a line in a draft shipment', async () => {
      // Default mocks have shipment in draft.
      const result = await service.updateShipmentLine(
        'e0000000-0000-0000-0000-000000000001',
        'f0000000-0000-0000-0000-000000000001',
        { quantityShipped: '4' },
        'admin',
      );
      expect(result).toBeDefined();
    });

    it('should reject if shipment is not in draft', async () => {
      await pg.db
        .update(salesOrderShipments)
        .set({ stateCode: 'dispatched' })
        .where(
          eq(
            salesOrderShipments.shipmentId,
            'e0000000-0000-0000-0000-000000000001',
          ),
        );
      await expect(
        service.updateShipmentLine(
          'e0000000-0000-0000-0000-000000000001',
          'f0000000-0000-0000-0000-000000000001',
          { quantityShipped: '4' },
          'admin',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // =========================================================================
  // changeShipmentState
  // =========================================================================

  describe('changeShipmentState', () => {
    async function setupWithState(currentState: string) {
      await pg.db
        .update(salesOrderShipments)
        .set({ stateCode: currentState as any })
        .where(
          eq(
            salesOrderShipments.shipmentId,
            'e0000000-0000-0000-0000-000000000001',
          ),
        );
      // Inventory is already seeded in the global beforeEach
    }

    it.each([['draft', 'cancelled']])(
      'should allow transition %s → %s',
      async (from, to) => {
        await setupWithState(from);
        await expect(
          service.changeShipmentState(
            'e0000000-0000-0000-0000-000000000001',
            to,
            'admin',
          ),
        ).resolves.toBeDefined();
      },
    );

    it.each([
      ['cancelled', 'draft'],
      ['cancelled', 'dispatched'],
      ['dispatched', 'cancelled'],
    ])('should reject transition %s → %s', async (from, to) => {
      await setupWithState(from);
      await expect(
        service.changeShipmentState(
          'e0000000-0000-0000-0000-000000000001',
          to,
          'admin',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject unknown state name', async () => {
      await expect(
        service.changeShipmentState(
          'e0000000-0000-0000-0000-000000000001',
          'bogus',
          'admin',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // =========================================================================
  // removeShipmentLine
  // =========================================================================

  describe('removeShipmentLine', () => {
    it('should remove a line from a draft shipment', async () => {
      // Default mocks have shipment in draft.
      await expect(
        service.removeShipmentLine(
          'e0000000-0000-0000-0000-000000000001',
          'f0000000-0000-0000-0000-000000000001',
          'admin',
        ),
      ).resolves.toBeUndefined();
    });

    it('should reject removal from dispatched shipment', async () => {
      await pg.db
        .update(salesOrderShipments)
        .set({ stateCode: 'dispatched' })
        .where(
          eq(
            salesOrderShipments.shipmentId,
            'e0000000-0000-0000-0000-000000000001',
          ),
        );
      await expect(
        service.removeShipmentLine(
          'e0000000-0000-0000-0000-000000000001',
          'f0000000-0000-0000-0000-000000000001',
          'admin',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // =========================================================================
  // findOne / findByOrder
  // =========================================================================

  describe('findOne', () => {
    it('should return shipment with lines', async () => {
      const result = await service.findOne(
        'e0000000-0000-0000-0000-000000000001',
      );
      expect(result).toHaveProperty(
        'shipmentId',
        'e0000000-0000-0000-0000-000000000001',
      );
      expect(result.lines).toHaveLength(1);
    });

    it('should throw NotFoundException for unknown shipment', async () => {
      await pg.db.delete(salesOrderShipmentLines);
      await pg.db.delete(salesOrderShipments);
      await expect(
        service.findOne('00000000-0000-0000-0000-000000000999'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByOrder', () => {
    it('should return all shipments for an order', async () => {
      const result = await service.findByOrder(
        '00000000-0000-0000-0000-000000000001',
      );
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty(
        'shipmentId',
        'e0000000-0000-0000-0000-000000000001',
      );
      expect(result[0].lines).toHaveLength(1);
    });
  });
});
