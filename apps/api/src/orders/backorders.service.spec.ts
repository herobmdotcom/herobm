import { Test, TestingModule } from '@nestjs/testing';
import { BackordersService, InventoryGap } from './backorders.service';
import { InventoryService } from '../inventory/inventory.service';
import { DRIZZLE } from '../drizzle/drizzle.module';

function createMockQueryBuilder(resolvedValue: any = []) {
  const qb: any = {
    values: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    returning: jest.fn().mockResolvedValue(resolvedValue),
    then: jest.fn().mockImplementation((cb: any) => cb(resolvedValue)),
  };
  return qb;
}

function createMockTx() {
  return {
    insert: jest
      .fn()
      .mockReturnValue(
        createMockQueryBuilder([
          { purchaseOrderId: 'po-123', purchaseOrderLineId: 'pol-123' },
        ]),
      ),
    execute: jest
      .fn()
      .mockResolvedValue([{ order_number: 'PO-20000101-0001' }]),
    select: jest.fn().mockReturnValue(
      createMockQueryBuilder([
        { productId: 'p1', vendorId: 'v1', costPrice: '10.50' },
        { productId: 'p2', vendorId: 'v1', costPrice: '15.00' },
      ]),
    ),
  };
}

function createMockDb() {
  const selectQb = createMockQueryBuilder([]);
  const db: any = {
    select: jest.fn().mockReturnValue({
      from: jest.fn().mockReturnValue(selectQb),
    }),
    insert: jest.fn().mockReturnValue(createMockQueryBuilder([])),
    update: jest.fn().mockReturnValue(createMockQueryBuilder([])),
    delete: jest.fn().mockReturnValue(createMockQueryBuilder([])),
    _selectQb: selectQb,
  };
  return db;
}

describe('BackordersService', () => {
  let service: BackordersService;
  let db: any;
  let inventoryService: any;

  beforeEach(async () => {
    db = createMockDb();
    inventoryService = {
      findByProductIds: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BackordersService,
        { provide: DRIZZLE, useValue: db },
        { provide: InventoryService, useValue: inventoryService },
      ],
    }).compile();

    service = module.get<BackordersService>(BackordersService);
  });

  describe('evaluateGaps', () => {
    it('should return empty if no valid product lines exist', async () => {
      db._selectQb.where.mockResolvedValueOnce([
        { salesOrderLineId: 'L1', productId: null, quantity: '10' },
      ]);
      const gaps = await service.evaluateGaps('SO1');
      expect(gaps).toEqual([]);
      expect(inventoryService.findByProductIds).not.toHaveBeenCalled();
    });

    it('should calculate gaps correctly based on ordered vs available quantity', async () => {
      db._selectQb.where.mockResolvedValueOnce([
        {
          salesOrderLineId: 'L1',
          productId: 'P1',
          quantity: '10',
          fulfillmentLocationId: 'LOC1',
        },
        {
          salesOrderLineId: 'L2',
          productId: 'P2',
          quantity: '5',
          fulfillmentLocationId: 'LOC1',
        },
        {
          salesOrderLineId: 'L3',
          productId: 'P3',
          quantity: '2',
          fulfillmentLocationId: 'LOC1',
        },
      ]);

      inventoryService.findByProductIds.mockResolvedValueOnce({
        data: [
          { productId: 'P1', locationId: 'LOC1', quantityAvailable: 3 }, // Short 7
          { productId: 'P2', locationId: 'LOC1', quantityAvailable: 10 }, // No gap
          { productId: 'P3', locationId: 'LOC1', quantityAvailable: 0 }, // Short 2
        ],
      });

      const gaps = await service.evaluateGaps('SO1');

      expect(gaps).toHaveLength(2);
      expect(gaps.find((g) => g.productId === 'P1')).toMatchObject({
        shortage: 7,
      });
      expect(gaps.find((g) => g.productId === 'P3')).toMatchObject({
        shortage: 2,
      });
    });
  });

  describe('triggerBackorders', () => {
    it('should gracefully return if no gaps are provided', async () => {
      const tx = createMockTx();
      await service.triggerBackorders('SO1', [], 'system', tx as any);
      expect(tx.insert).not.toHaveBeenCalled();
    });

    it('should create draft POs for gaps with preferred suppliers', async () => {
      const tx = createMockTx();
      const gaps: InventoryGap[] = [
        {
          salesOrderLineId: 'L1',
          productId: 'p1',
          productDescription: 'Prod 1',
          orderedQuantity: 10,
          availableQuantity: 0,
          shortage: 10,
          locationId: 'LOC1',
        },
        {
          salesOrderLineId: 'L2',
          productId: 'p2',
          productDescription: 'Prod 2',
          orderedQuantity: 5,
          availableQuantity: 0,
          shortage: 5,
          locationId: 'LOC1',
        },
      ];

      await service.triggerBackorders('SO1', gaps, 'test-user', tx as any);

      expect(tx.insert).toHaveBeenCalled();
    });
  });
});
