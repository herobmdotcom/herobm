import { AppConfigService } from '../settings/app-config.service';
import { Test, TestingModule } from '@nestjs/testing';
import { ReceptionsService } from './receptions.service';
import { InventoryService } from '../inventory/inventory.service';
import { DRIZZLE } from '../drizzle/drizzle.module';

function createMockQueryBuilder(resolvedValue: any = []) {
  const qb: any = {
    values: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    returning: jest.fn().mockResolvedValue(resolvedValue),
    then: jest.fn().mockImplementation((cb: any) => cb(resolvedValue)),
  };
  return qb;
}

describe('ReceptionsService', () => {
  let service: ReceptionsService;
  let mockDb: any;
  let mockInventoryService: any;
  let mockTx: any;

  beforeEach(async () => {
    mockTx = {
      select: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue(createMockQueryBuilder([])),
      }),
      insert: jest.fn().mockReturnValue(createMockQueryBuilder([{}])),
      update: jest.fn().mockReturnValue(createMockQueryBuilder([])),
    };

    mockDb = {
      transaction: jest.fn().mockImplementation(async (cb) => cb(mockTx)),
      select: jest.fn(),
    };

    mockInventoryService = {
      recordInventoryMovement: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: AppConfigService,
          useValue: {
            valuationMethod: jest.fn().mockReturnValue('standard'),
          },
        },
        ReceptionsService,
        { provide: DRIZZLE, useValue: mockDb },
        { provide: InventoryService, useValue: mockInventoryService },
      ],
    }).compile();

    service = module.get<ReceptionsService>(ReceptionsService);
  });

  describe('create', () => {
    let selectMocks: any[];

    beforeEach(() => {
      mockTx.select = jest.fn().mockImplementation(() => {
        const result = selectMocks.shift() || [];
        const qb = createMockQueryBuilder(result);

        qb.from = jest.fn().mockReturnValue(qb);
        qb.where = jest.fn().mockReturnValue(qb);
        qb.limit = jest.fn().mockReturnValue(qb);
        qb.innerJoin = jest.fn().mockReturnValue(qb);
        qb.leftJoin = jest.fn().mockReturnValue(qb);

        return qb;
      });

      const qbCreate = createMockQueryBuilder([
        { receptionId: 'rec-1', receptionNumber: 'REC-123' },
      ]);
      mockTx.insert = jest.fn().mockImplementation(() => qbCreate);
    });

    it('should transition to partially_received when lines are not fully met', async () => {
      selectMocks = [
        [
          {
            purchaseOrderLineId: 'l1',
            productId: 'p1',
            quantity: '10',
            quantityReceived: '0',
            pricePerUnit: '5',
          },
        ], // poLine
        [{ productId: 'p1', standardCost: '5', quantityOnHand: '0' }], // productRow
        [{ quantity: '10', quantityReceived: '5' }], // allPoLines
        [{ deliveryLocationId: 'loc-1' }], // deliveryLocation
        [{ binId: 'bin-1' }], // dock bin
        [{ receptionId: 'rec-1', receptionNumber: 'REC-123' }], // findOne final return
        [], // lines
      ];

      await service.create(
        {
          purchaseOrderId: 'po-1',
          lines: [{ purchaseOrderLineId: 'l1', quantityReceived: '5' }],
        },
        'admin',
      );

      expect(mockTx.update).toHaveBeenCalled();
      const updateSetCalls = mockTx.update().set.mock.calls;
      const stateUpdate = updateSetCalls.find(
        (args: any) => args[0] && args[0].stateCode === 'partially_received',
      );
      expect(stateUpdate).toBeDefined();
    });

    it('should transition to received when all lines are fully met', async () => {
      selectMocks = [
        [
          {
            purchaseOrderLineId: 'l1',
            productId: 'p1',
            quantity: '10',
            quantityReceived: '0',
            pricePerUnit: '5',
          },
        ],
        [{ productId: 'p1', standardCost: '5', quantityOnHand: '0' }],
        [{ quantity: '10', quantityReceived: '10' }], // all lines
        [{ deliveryLocationId: 'loc-1' }],
        [{ binId: 'bin-1' }],
        [{ receptionId: 'rec-1', receptionNumber: 'REC-123' }],
        [],
      ];

      await service.create(
        {
          purchaseOrderId: 'po-1',
          lines: [{ purchaseOrderLineId: 'l1', quantityReceived: '10' }],
        },
        'admin',
      );

      const updateSetCalls = mockTx.update().set.mock.calls;
      const stateUpdate = updateSetCalls.find(
        (args: any) => args[0] && args[0].stateCode === 'received',
      );
      expect(stateUpdate).toBeDefined();
    });

    it('should trigger over_received_warning event when receiving more than bounds', async () => {
      selectMocks = [
        [
          {
            purchaseOrderLineId: 'l1',
            productId: 'p1',
            quantity: '10',
            quantityReceived: '5',
            pricePerUnit: '5',
          },
        ],
        [{ productId: 'p1', standardCost: '5', quantityOnHand: '5' }],
        [{ quantity: '10', quantityReceived: '15' }],
        [{ deliveryLocationId: 'loc-1' }],
        [{ binId: 'bin-1' }],
        [{ receptionId: 'rec-1' }],
        [],
      ];

      await service.create(
        {
          purchaseOrderId: 'po-1',
          lines: [{ purchaseOrderLineId: 'l1', quantityReceived: '10' }],
        },
        'admin',
      );

      const insertValuesCalls = mockTx.insert().values.mock.calls;
      const eventInsert = insertValuesCalls.find(
        (args: any) => args[0] && args[0].eventType === 'over_received_warning',
      );
      expect(eventInsert).toBeDefined();
    });

    it('should trigger price_discrepancy_warning event when invoicing value mismatches', async () => {
      selectMocks = [
        [
          {
            purchaseOrderLineId: 'l1',
            productId: 'p1',
            quantity: '10',
            quantityReceived: '0',
            pricePerUnit: '5',
          },
        ],
        [{ productId: 'p1', standardCost: '5', quantityOnHand: '0' }],
        [{ quantity: '10', quantityReceived: '10' }],
        [{ deliveryLocationId: 'loc-1' }],
        [{ binId: 'bin-1' }],
        [{ receptionId: 'rec-1' }],
        [],
      ];

      await service.create(
        {
          purchaseOrderId: 'po-1',
          lines: [
            {
              purchaseOrderLineId: 'l1',
              quantityReceived: '10',
              invoicePricePerUnit: 7,
            },
          ],
        },
        'admin',
      );

      const insertValuesCalls = mockTx.insert().values.mock.calls;
      const eventInsert = insertValuesCalls.find(
        (args: any) =>
          args[0] && args[0].eventType === 'price_discrepancy_warning',
      );
      expect(eventInsert).toBeDefined();
    });
  });
});
