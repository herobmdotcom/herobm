import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { ShipmentService } from './shipment.service';
import { InventoryService } from '../inventory/inventory.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { NotFoundException, BadRequestException } from '@nestjs/common';

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

function createMockQueryBuilder(resolvedValue: any = []) {
  const qb: any = {
    values: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    returning: jest.fn().mockResolvedValue(resolvedValue),
    then: jest.fn().mockImplementation((cb) => cb(resolvedValue)),
  };
  return qb;
}

function createMockTx() {
  return {
    select: jest.fn().mockReturnValue({
      from: jest.fn().mockReturnValue(createMockQueryBuilder([])),
    }),
    insert: jest.fn().mockReturnValue(createMockQueryBuilder([])),
    update: jest.fn().mockReturnValue(createMockQueryBuilder([])),
    delete: jest.fn().mockReturnValue(createMockQueryBuilder([])),
  };
}

function createMockDb() {
  const selectQb = createMockQueryBuilder([]);
  const db: any = {
    select: jest
      .fn()
      .mockReturnValue({ from: jest.fn().mockReturnValue(selectQb) }),
    insert: jest.fn().mockReturnValue(createMockQueryBuilder([])),
    update: jest.fn().mockReturnValue(createMockQueryBuilder([])),
    delete: jest.fn().mockReturnValue(createMockQueryBuilder([])),
    transaction: jest
      .fn()
      .mockImplementation(async (cb: any) => cb(createMockTx())),
    _selectQb: selectQb,
  };
  return db;
}

// Shared test data
const PICKING_ORDER = {
  salesOrderId: 'order-001',
  orderNumber: 'ORD-20260316-0001',
  stateCode: 'picking',
  customerId: 'c0000000-0000-0000-0000-000000000001',
};

const ORDER_LINE = {
  salesOrderLineId: 'line-001',
  salesOrderId: 'order-001',
  lineNumber: 1,
  productId: 'PROD-001',
  productDescription: 'Widget A',
  quantity: '10',
  quantityPicked: '10',
  pricePerUnit: '50.00',
  amount: '500.00',
};

const MOCK_SHIPMENT = {
  shipmentId: 'ship-001',
  shipmentNumber: 'SHP-20260316-0001',
  salesOrderId: 'order-001',
  stateCode: 'draft',
  notes: null,
  createdBy: 'admin',
};

const MOCK_SHIPMENT_LINE = {
  shipmentLineId: 'shipline-001',
  shipmentId: 'ship-001',
  salesOrderLineId: 'line-001',
  quantityShipped: '5',
};

describe('ShipmentService', () => {
  let service: ShipmentService;
  let mockDb: any;
  let mockInventoryService: any;

  function mockSelectChain(responses: Record<number, any[]>) {
    let call = 0;
    mockDb.select = jest.fn().mockReturnValue({
      from: jest.fn().mockImplementation(() => {
        call++;
        const data = responses[call] ?? [];
        const qb = createMockQueryBuilder(data);
        qb.innerJoin = jest.fn().mockReturnValue(qb);
        qb.leftJoin = jest.fn().mockReturnValue(qb);
        return qb;
      }),
    });
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    mockDb = createMockDb();

    mockInventoryService = {
      recordInventoryMovement: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: ConfigService, useValue: { get: jest.fn() } },
        ShipmentService,
        { provide: DRIZZLE, useValue: mockDb },
        { provide: InventoryService, useValue: mockInventoryService },
      ],
    }).compile();

    service = module.get<ShipmentService>(ShipmentService);
  });

  // =========================================================================
  // generateShipmentNumber
  // =========================================================================

  describe('generateShipmentNumber', () => {
    it('should generate first sequence number if none exist today', async () => {
      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([]),
            }),
          }),
        }),
      });

      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const num = await service.generateShipmentNumber();
      expect(num).toBe(`SHP-${today}-0001`);
    });

    it('should increment the latest sequence number', async () => {
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockReturnValue({
              limit: jest
                .fn()
                .mockResolvedValue([{ shipmentNumber: `SHP-${today}-0005` }]),
            }),
          }),
        }),
      });

      const num = await service.generateShipmentNumber();
      expect(num).toBe(`SHP-${today}-0006`);
    });
  });

  // =========================================================================
  // createShipment
  // =========================================================================

  describe('createShipment', () => {
    it('should create a shipment when order is in picking state and qty is valid', async () => {
      mockSelectChain({
        1: [PICKING_ORDER],
        2: [ORDER_LINE], // first findOrderLine
        3: [ORDER_LINE], // findOrderLine inside assertShipmentQtyAvailable
        4: [], // getCommittedPerLine (shipments)
        5: [], // generateShipmentNumber (max shipment lookup)
      });

      const txQb = createMockQueryBuilder([MOCK_SHIPMENT]);
      mockDb.transaction = jest.fn().mockImplementation(async (cb: any) => {
        const tx = createMockTx();
        tx.insert = jest.fn().mockReturnValue(txQb);
        return cb(tx);
      });

      const dto = {
        lines: [{ salesOrderLineId: 'line-001', quantityShipped: '5' }],
      };
      const result = await service.createShipment('order-001', dto, 'admin');

      expect(result).toHaveProperty('shipmentId', 'ship-001');
      expect(mockDb.transaction).toHaveBeenCalled();
    });

    it('should reject if order is not in picking state', async () => {
      mockSelectChain({ 1: [{ ...PICKING_ORDER, stateCode: 'draft' }] });
      const dto = {
        lines: [{ salesOrderLineId: 'line-001', quantityShipped: '5' }],
      };
      await expect(
        service.createShipment('order-001', dto, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject if shipped quantity is greater than available', async () => {
      mockSelectChain({
        1: [PICKING_ORDER],
        2: [ORDER_LINE],
        3: [ORDER_LINE],
        4: [], // getCommittedPerLine
      });
      // ORDER_LINE has quantityPicked=10. Requesting 15 should fail.
      const dto = {
        lines: [{ salesOrderLineId: 'line-001', quantityShipped: '15' }],
      };
      await expect(
        service.createShipment('order-001', dto, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // =========================================================================
  // updateShipment
  // =========================================================================

  describe('updateShipment', () => {
    it('should allow updating notes on a draft shipment', async () => {
      mockSelectChain({ 1: [MOCK_SHIPMENT] });

      const txQb = createMockQueryBuilder([MOCK_SHIPMENT]);
      mockDb.transaction = jest.fn().mockImplementation(async (cb: any) => {
        const tx = createMockTx();
        tx.update = jest.fn().mockReturnValue(txQb);
        return cb(tx);
      });

      const result = await service.updateShipment(
        'ship-001',
        { notes: 'Updated notes' },
        'admin',
      );
      expect(result).toHaveProperty('shipmentId', 'ship-001');
    });

    it('should reject updating a cancelled shipment', async () => {
      mockSelectChain({ 1: [{ ...MOCK_SHIPMENT, stateCode: 'cancelled' }] });
      await expect(
        service.updateShipment('ship-001', { notes: 'Updated notes' }, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // =========================================================================
  // addShipmentLine
  // =========================================================================

  describe('addShipmentLine', () => {
    it('should add a line to a draft shipment', async () => {
      mockSelectChain({
        1: [MOCK_SHIPMENT], // shipment
        2: [ORDER_LINE], // first findOrderLine
        3: [ORDER_LINE], // findOrderLine inside assertShipmentQtyAvailable
        4: [], // getCommittedPerLine (shipments)
      });

      const txQb = createMockQueryBuilder([MOCK_SHIPMENT_LINE]);
      mockDb.transaction = jest.fn().mockImplementation(async (cb: any) => {
        const tx = createMockTx();
        tx.insert = jest.fn().mockReturnValue(txQb);
        tx.update = jest.fn().mockReturnValue(createMockQueryBuilder([]));
        return cb(tx);
      });

      const result = await service.addShipmentLine(
        'ship-001',
        { salesOrderLineId: 'line-001', quantityShipped: '2' },
        'admin',
      );
      expect(result).toHaveProperty('quantityShipped', '5');
    });

    it('should reject if shipment is not in draft', async () => {
      mockSelectChain({ 1: [{ ...MOCK_SHIPMENT, stateCode: 'cancelled' }] });
      await expect(
        service.addShipmentLine(
          'ship-001',
          { salesOrderLineId: 'line-001', quantityShipped: '2' },
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
      mockSelectChain({
        1: [MOCK_SHIPMENT], // shipment
        2: [MOCK_SHIPMENT_LINE], // existing line
        3: [ORDER_LINE], // first findOrderLine
        4: [ORDER_LINE], // findOrderLine inside assert
        5: [], // shipped map (shipments)
        6: [MOCK_SHIPMENT_LINE], // existing line excluding self inside assert
      });

      const txQb = createMockQueryBuilder([
        { ...MOCK_SHIPMENT_LINE, quantityShipped: '4' },
      ]);
      mockDb.transaction = jest.fn().mockImplementation(async (cb: any) => {
        const tx = createMockTx();
        tx.update = jest.fn().mockReturnValue(txQb);
        return cb(tx);
      });

      const result = await service.updateShipmentLine(
        'ship-001',
        'shipline-001',
        { quantityShipped: '4' },
        'admin',
      );
      expect(result).toHaveProperty('quantityShipped', '4');
    });

    it('should reject if shipment is not in draft', async () => {
      mockSelectChain({ 1: [{ ...MOCK_SHIPMENT, stateCode: 'dispatched' }] });
      await expect(
        service.updateShipmentLine(
          'ship-001',
          'shipline-001',
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
    function setupWithState(currentState: string) {
      mockSelectChain({
        1: [{ ...MOCK_SHIPMENT, stateCode: currentState }],
      });
      const txUpdateQb = createMockQueryBuilder([
        { ...MOCK_SHIPMENT, stateCode: '' },
      ]);
      mockDb.transaction = jest.fn().mockImplementation(async (cb: any) => {
        const tx = createMockTx();
        tx.update = jest.fn().mockReturnValue(txUpdateQb);
        let txSelectCall = 0;
        // Shared counter across all catch-all .where() calls in the tx
        let catchAllWhereCount = 0;
        tx.select = jest.fn().mockReturnValue({
          from: jest.fn().mockImplementation(() => {
            txSelectCall++;
            if (txSelectCall === 1) {
              // Fetch shipment lines
              return createMockQueryBuilder([MOCK_SHIPMENT_LINE]);
            }
            if (txSelectCall === 2) {
              // findOrderLine for the shipment line
              return {
                where: jest.fn().mockReturnValue(
                  Object.assign(Promise.resolve([ORDER_LINE]), {
                    limit: jest.fn().mockResolvedValue([ORDER_LINE]),
                  }),
                ),
              };
            }
            // Calls 3+: flexible catch-all.
            // getInvoicedPerLine uses .innerJoin() → returns empty.
            // getCommittedPerLine makes 2 .where() calls:
            //   1st: shipments → [MOCK_SHIPMENT]
            //   2nd: shipment lines → [MOCK_SHIPMENT_LINE]
            // Subsequent: findOrder, COGS → [PICKING_ORDER]
            const catchAllQb: any = {};
            catchAllQb.where = jest.fn().mockImplementation(() => {
              catchAllWhereCount++;
              let data: any[];
              if (catchAllWhereCount === 1) {
                data = [{ ...MOCK_SHIPMENT, stateCode: currentState }];
              } else if (catchAllWhereCount === 2) {
                data = [MOCK_SHIPMENT_LINE];
              } else {
                data = [
                  {
                    ...PICKING_ORDER,
                    productId: 'PROD-001',
                    binId: 'sh-bin-1',
                    locationNo: 'MAIN',
                    standardCost: '10',
                    quantityOnHand: '100',
                    weightedAverageCost: '10',
                    netPicked: 10,
                    quantity: 10,
                  },
                ];
              }
              const resolved = Promise.resolve(data);
              return Object.assign(resolved, {
                orderBy: jest.fn().mockReturnValue(
                  Object.assign(Promise.resolve(data), {
                    limit: jest.fn().mockResolvedValue(data),
                  }),
                ),
                limit: jest.fn().mockResolvedValue(data),
                groupBy: jest.fn().mockReturnValue(Promise.resolve(data)),
              });
            });
            catchAllQb.innerJoin = jest.fn().mockImplementation(() => {
              const emptyQb: any = {};
              emptyQb.where = jest.fn().mockReturnValue(
                Object.assign(Promise.resolve([]), {
                  orderBy: jest.fn().mockReturnValue(Promise.resolve([])),
                  limit: jest.fn().mockResolvedValue([]),
                  groupBy: jest.fn().mockReturnValue(Promise.resolve([])),
                }),
              );
              emptyQb.innerJoin = jest.fn().mockReturnValue(emptyQb);
              emptyQb.groupBy = jest.fn().mockReturnValue(emptyQb);
              return emptyQb;
            });
            return catchAllQb;
          }),
        });
        return cb(tx);
      });
    }

    it.each([['draft', 'cancelled']])(
      'should allow transition %s → %s',
      async (from, to) => {
        setupWithState(from);
        await expect(
          service.changeShipmentState('ship-001', to, 'admin'),
        ).resolves.toBeDefined();
      },
    );

    it.each([
      ['cancelled', 'draft'],
      ['cancelled', 'dispatched'],
      ['dispatched', 'cancelled'],
    ])('should reject transition %s → %s', async (from, to) => {
      setupWithState(from);
      await expect(
        service.changeShipmentState('ship-001', to, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject unknown state name', async () => {
      await expect(
        service.changeShipmentState('ship-001', 'bogus', 'admin'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // =========================================================================
  // removeShipmentLine
  // =========================================================================

  describe('removeShipmentLine', () => {
    it('should remove a line from a draft shipment', async () => {
      mockSelectChain({
        1: [MOCK_SHIPMENT],
        2: [MOCK_SHIPMENT_LINE],
      });
      mockDb.transaction = jest
        .fn()
        .mockImplementation(async (cb: any) => cb(createMockTx()));
      await expect(
        service.removeShipmentLine('ship-001', 'shipline-001', 'admin'),
      ).resolves.toBeUndefined();
    });

    it('should reject removal from dispatched shipment', async () => {
      mockSelectChain({
        1: [{ ...MOCK_SHIPMENT, stateCode: 'dispatched' }],
      });
      await expect(
        service.removeShipmentLine('ship-001', 'shipline-001', 'admin'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // =========================================================================
  // findOne / findByOrder
  // =========================================================================

  describe('findOne', () => {
    it('should return shipment with lines', async () => {
      mockSelectChain({
        1: [MOCK_SHIPMENT],
        2: [{ ...MOCK_SHIPMENT_LINE, productNumber: 'PN-1' }],
      });
      const result = await service.findOne('ship-001');
      expect(result).toHaveProperty('shipmentId', 'ship-001');
      expect(result.lines).toHaveLength(1);
    });

    it('should throw NotFoundException for unknown shipment', async () => {
      mockSelectChain({ 1: [] });
      await expect(service.findOne('NONEXISTENT')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByOrder', () => {
    it('should return all shipments for an order', async () => {
      let call = 0;
      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockImplementation(() => {
          call++;
          if (call === 1) {
            return createMockQueryBuilder([MOCK_SHIPMENT]);
          }
          const qb = createMockQueryBuilder([
            { ...MOCK_SHIPMENT_LINE, productNumber: 'PN-1' },
          ]);
          qb.innerJoin = jest.fn().mockReturnValue(qb);
          qb.leftJoin = jest.fn().mockReturnValue(qb);
          return qb;
        }),
      });

      const result = await service.findByOrder('order-001');
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('shipmentId', 'ship-001');
      expect(result[0].lines).toHaveLength(1);
    });
  });
});
