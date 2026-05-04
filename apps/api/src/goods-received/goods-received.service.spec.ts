import { GoodsReceivedService } from './goods-received.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { InventoryService } from '../inventory/inventory.service';
import { setupTestModule } from '../../test/utils/test-module';
import { MockDrizzle } from '../../test/utils/mock-drizzle';
import { DRIZZLE } from '../drizzle/drizzle.module';

jest.mock('../purchase-orders/purchase-order-lifecycle-rules', () => ({
  evaluatePOLifecycleRules: jest.fn().mockResolvedValue([]),
}));

describe('GoodsReceivedService', () => {
  let service: GoodsReceivedService;
  let mockDb: MockDrizzle;
  let mockInventoryService: any;

  beforeEach(async () => {
    mockDb = new MockDrizzle();
    (mockDb as any).$count = jest.fn().mockReturnValue(0);

    mockInventoryService = {
      recordInventoryMovement: jest.fn().mockResolvedValue(undefined),
    };

    const module = await setupTestModule([
      GoodsReceivedService,
      { provide: DRIZZLE, useValue: mockDb },
      { provide: InventoryService, useValue: mockInventoryService },
    ]).compile();

    service = module.get<GoodsReceivedService>(GoodsReceivedService);
  });

  afterEach(() => {
    mockDb.clearMocks();
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should throw NotFoundException when supplier does not exist', async () => {
      mockDb.onTable('suppliers', []);

      await expect(
        service.create(
          {
            vendorId: 'missing-vendor',
            locationId: 'loc-1',
            lines: [{ productId: 'p-1', quantityReceived: '5' }],
          },
          'admin',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when location does not exist', async () => {
      mockDb.onTable('suppliers', [{ vendorId: 'v1', name: 'ACME' }]);
      mockDb.onTable('locations', []);

      await expect(
        service.create(
          {
            vendorId: 'v1',
            locationId: 'missing-loc',
            lines: [{ productId: 'p-1', quantityReceived: '5' }],
          },
          'admin',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when product does not exist', async () => {
      mockDb.onTable('suppliers', [{ vendorId: 'v1', name: 'ACME' }]);
      mockDb.onTable('locations', [{ locationId: 'loc-1' }]);
      mockDb.onTable('products', []);

      await expect(
        service.create(
          {
            vendorId: 'v1',
            locationId: 'loc-1',
            lines: [{ productId: 'missing-product', quantityReceived: '5' }],
          },
          'admin',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should set match_status to "matched" when exactly one open PO line exists', async () => {
      mockDb.onTable('suppliers', [{ vendorId: 'v1', name: 'ACME' }]);
      mockDb.onTable('locations', [{ locationId: 'loc-1' }]);
      mockDb.onTable('products', [
        {
          productId: 'p-1',
          standardCost: '10',
          weightedAverageCost: '10',
          qoh: 100,
        },
      ]);
      mockDb.onTable('purchase_order_lines', [
        {
          purchaseOrderLineId: 'pol-1',
          purchaseOrderId: 'po-1',
          quantity: '20',
          quantityReceived: '0',
        },
      ]);
      mockDb.onTable('zones', [{ zoneId: 'z1' }]);
      mockDb.onTable('bins', [{ binId: 'b1' }]);
      mockDb.onTable('goods_received', [
        { receipt: { goodsReceivedId: 'gr-1', receiptNumber: 'GR-ABCD1234' } },
      ]);
      mockDb.onTable('goods_received_lines', []);

      // Spy on the insert method
      const insertSpy = jest.spyOn(mockDb, 'insert');

      await service.create(
        {
          vendorId: 'v1',
          locationId: 'loc-1',
          lines: [{ productId: 'p-1', quantityReceived: '5' }],
        },
        'admin',
      );

      // The second call to insert is for lines (1st is header, 2nd is lines)
      const linesInsertQb = insertSpy.mock.results[1].value;
      // Extract the values passed to `values()`
      const capturedLines = linesInsertQb.values.mock.calls[0][0];

      expect(capturedLines.length).toBe(1);
      expect(capturedLines[0].matchStatus).toBe('matched');
      expect(capturedLines[0].purchaseOrderLineId).toBe('pol-1');
      expect(capturedLines[0].purchaseOrderId).toBe('po-1');
    });

    it('should set match_status to "ambiguous" when multiple open PO lines exist', async () => {
      mockDb.onTable('suppliers', [{ vendorId: 'v1', name: 'ACME' }]);
      mockDb.onTable('locations', [{ locationId: 'loc-1' }]);
      mockDb.onTable('products', [
        {
          productId: 'p-1',
          standardCost: '10',
          weightedAverageCost: '10',
          qoh: 100,
        },
      ]);
      mockDb.onTable('purchase_order_lines', [
        {
          purchaseOrderLineId: 'pol-1',
          purchaseOrderId: 'po-1',
          quantity: '20',
          quantityReceived: '0',
        },
        {
          purchaseOrderLineId: 'pol-2',
          purchaseOrderId: 'po-2',
          quantity: '10',
          quantityReceived: '0',
        },
      ]);
      mockDb.onTable('zones', [{ zoneId: 'z1' }]);
      mockDb.onTable('bins', [{ binId: 'b1' }]);
      mockDb.onTable('goods_received', [
        { receipt: { goodsReceivedId: 'gr-1' } },
      ]);
      mockDb.onTable('goods_received_lines', []);

      const insertSpy = jest.spyOn(mockDb, 'insert');

      await service.create(
        {
          vendorId: 'v1',
          locationId: 'loc-1',
          lines: [{ productId: 'p-1', quantityReceived: '5' }],
        },
        'admin',
      );

      const capturedLines =
        insertSpy.mock.results[1].value.values.mock.calls[0][0];

      expect(capturedLines[0].matchStatus).toBe('ambiguous');
      expect(capturedLines[0].purchaseOrderLineId).toBeNull();
      expect(capturedLines[0].purchaseOrderId).toBeNull();
    });

    it('should set match_status to "unmatched" when no open PO lines exist', async () => {
      mockDb.onTable('suppliers', [{ vendorId: 'v1', name: 'ACME' }]);
      mockDb.onTable('locations', [{ locationId: 'loc-1' }]);
      mockDb.onTable('products', [
        {
          productId: 'p-1',
          standardCost: '10',
          weightedAverageCost: '10',
          qoh: 100,
        },
      ]);
      mockDb.onTable('purchase_order_lines', []);
      mockDb.onTable('zones', [{ zoneId: 'z1' }]);
      mockDb.onTable('bins', [{ binId: 'b1' }]);
      mockDb.onTable('goods_received', [
        { receipt: { goodsReceivedId: 'gr-1' } },
      ]);
      mockDb.onTable('goods_received_lines', []);

      const insertSpy = jest.spyOn(mockDb, 'insert');

      await service.create(
        {
          vendorId: 'v1',
          locationId: 'loc-1',
          lines: [{ productId: 'p-1', quantityReceived: '5' }],
        },
        'admin',
      );

      const capturedLines =
        insertSpy.mock.results[1].value.values.mock.calls[0][0];

      expect(capturedLines[0].matchStatus).toBe('unmatched');
      expect(capturedLines[0].purchaseOrderLineId).toBeNull();
      expect(capturedLines[0].purchaseOrderId).toBeNull();
    });

    it('should handle multiple lines with different match outcomes', async () => {
      mockDb.onTable('suppliers', [{ vendorId: 'v1', name: 'ACME' }]);
      mockDb.onTable('locations', [{ locationId: 'loc-1' }]);
      mockDb.onTable('products', [
        {
          productId: 'p-A',
          standardCost: '10',
          weightedAverageCost: '10',
          qoh: 100,
        },
        {
          productId: 'p-B',
          standardCost: '20',
          weightedAverageCost: '20',
          qoh: 50,
        },
      ]);

      // Dynamic mock for purchase_order_lines since the service loops
      let calls = 0;
      mockDb.onTable('purchase_order_lines', () => {
        calls++;
        if (calls === 1)
          return [
            {
              purchaseOrderLineId: 'pol-A',
              purchaseOrderId: 'po-A',
              quantity: '10',
              quantityReceived: '0',
            },
          ]; // match for A
        if (calls === 2) return []; // unmatch for B
        return [{ quantity: '10', quantityReceived: '3' }]; // recompute PO
      });

      mockDb.onTable('zones', [{ zoneId: 'z1' }]);
      mockDb.onTable('bins', [{ binId: 'b1' }]);
      mockDb.onTable('goods_received', [
        { receipt: { goodsReceivedId: 'gr-1' } },
      ]);
      mockDb.onTable('goods_received_lines', []);

      const insertSpy = jest.spyOn(mockDb, 'insert');

      await service.create(
        {
          vendorId: 'v1',
          locationId: 'loc-1',
          lines: [
            { productId: 'p-A', quantityReceived: '3' },
            { productId: 'p-B', quantityReceived: '7' },
          ],
        },
        'admin',
      );

      const capturedLines =
        insertSpy.mock.results[1].value.values.mock.calls[0][0];

      expect(capturedLines).toHaveLength(2);
      expect(capturedLines[0].matchStatus).toBe('matched');
      expect(capturedLines[1].matchStatus).toBe('unmatched');
    });

    it('should update PO state when fully received', async () => {
      mockDb.onTable('suppliers', [{ vendorId: 'v1', name: 'ACME' }]);
      mockDb.onTable('locations', [{ locationId: 'loc-1' }]);
      mockDb.onTable('products', [
        {
          productId: 'p-1',
          standardCost: '10',
          weightedAverageCost: '10',
          qoh: 100,
        },
      ]);

      let calls = 0;
      mockDb.onTable('purchase_order_lines', () => {
        calls++;
        if (calls === 1)
          return [
            {
              purchaseOrderLineId: 'pol-1',
              purchaseOrderId: 'po-1',
              quantity: '10',
              quantityReceived: '0',
            },
          ];
        return [{ quantity: '10', quantityReceived: '10' }]; // recompute state = fully received
      });

      mockDb.onTable('zones', [{ zoneId: 'z1' }]);
      mockDb.onTable('bins', [{ binId: 'b1' }]);
      mockDb.onTable('goods_received', [
        { receipt: { goodsReceivedId: 'gr-1' } },
      ]);
      mockDb.onTable('goods_received_lines', []);

      const updateSpy = jest.spyOn(mockDb, 'update');

      await service.create(
        {
          vendorId: 'v1',
          locationId: 'loc-1',
          lines: [{ productId: 'p-1', quantityReceived: '10' }],
        },
        'admin',
      );

      expect(updateSpy).toHaveBeenCalled();
    });

    it('should route dimensions from supplier group to GL posting', async () => {
      mockDb.onTable('suppliers', [
        {
          vendorId: 'v1',
          name: 'ACME',
          costCenterId: 'cc-recv',
          activityId: 'act-recv',
        },
      ]);
      mockDb.onTable('locations', [{ locationId: 'loc-1' }]);
      mockDb.onTable('products', [
        {
          productId: 'p-1',
          standardCost: '10',
          weightedAverageCost: '10',
          qoh: 100,
        },
      ]);
      mockDb.onTable('purchase_order_lines', [
        {
          purchaseOrderLineId: 'pol-1',
          purchaseOrderId: 'po-1',
          quantity: '10',
          quantityReceived: '0',
          pricePerUnit: '10.00',
        },
      ]);
      mockDb.onTable('zones', [{ zoneId: 'z1' }]);
      mockDb.onTable('bins', [{ binId: 'b1' }]);
      mockDb.onTable('goods_received', [
        { receipt: { goodsReceivedId: 'gr-1', receiptNumber: 'GR-1' } },
      ]);
      mockDb.onTable('goods_received_lines', []);

      const glService = (service as any).glService;
      const postSpy = jest.spyOn(glService, 'postJournalEntry');

      await service.create(
        {
          vendorId: 'v1',
          locationId: 'loc-1',
          lines: [{ productId: 'p-1', quantityReceived: '5' }],
        },
        'admin',
      );

      expect(postSpy).toHaveBeenCalled();
      const glLines = postSpy.mock.calls[0][0] as any[];
      glLines.forEach((l: any) => {
        expect(l.costCenterId).toBe('cc-recv');
        expect(l.activityId).toBe('act-recv');
      });
    });
  });

  describe('findOne', () => {
    it('should throw NotFoundException when receipt does not exist', async () => {
      mockDb.onTable('goods_received', []);

      await expect(service.findOne('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
