import { Test, TestingModule } from '@nestjs/testing';
import { PurchaseOrdersService } from './purchase-orders.service';
import { InventoryService } from '../inventory/inventory.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { SuppliersService } from '../suppliers/suppliers.service';
import { TaxCategoriesService } from '../tax/tax-categories.service';
import { AppConfigService } from '../settings/app-config.service';

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

function createMockQueryBuilder(resolvedValue: any = []) {
  const qb: any = {
    values: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    as: jest.fn().mockReturnThis(),
    subquery: jest.fn().mockReturnThis(),
    $dynamic: jest.fn().mockReturnThis(),
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
    execute: jest.fn().mockResolvedValue([]),
  };
}

function createMockDb() {
  const selectQb = createMockQueryBuilder([]);
  const db: any = {
    select: jest.fn().mockReturnValue({
      from: jest.fn().mockImplementation(() => {
        return selectQb;
      }),
    }),
    insert: jest.fn().mockReturnValue(createMockQueryBuilder([])),
    update: jest.fn().mockReturnValue(createMockQueryBuilder([])),
    delete: jest.fn().mockReturnValue(createMockQueryBuilder([])),
    transaction: jest
      .fn()
      .mockImplementation(async (cb: any) => cb(createMockTx())),
    _selectQb: selectQb, // For manual inspection
  };
  return db;
}

describe('PurchaseOrdersService', () => {
  let service: PurchaseOrdersService;
  let mockDb: any;
  let mockInventoryService: any;

  function mockTransaction(
    orderResult: any,
    linesResult: any[] = [],
    eventsResult: any[] = [],
    isCreate: boolean = false,
  ) {
    const mockTx = createMockTx();

    let txSelectCall = 0;
    mockTx.select = jest.fn().mockReturnValue({
      from: jest.fn().mockImplementation(() => {
        txSelectCall++;
        if (isCreate) {
          const cycle = (txSelectCall - 1) % 5;
          if (cycle === 0)
            return createMockQueryBuilder([{ locationId: 'loc-1' }]);
          if (cycle === 1) return createMockQueryBuilder([orderResult]);
          if (cycle === 2) return createMockQueryBuilder(linesResult);
          if (cycle === 3)
            return createMockQueryBuilder([
              { productId: 'p1', uomCode: 'EA', divisor: 1 },
            ]);
          if (cycle === 4) return createMockQueryBuilder(eventsResult);
        } else {
          const cycle = (txSelectCall - 1) % 4;
          if (cycle === 0) return createMockQueryBuilder([orderResult]);
          if (cycle === 1) return createMockQueryBuilder(linesResult);
          if (cycle === 2)
            return createMockQueryBuilder([
              { productId: 'p1', uomCode: 'EA', divisor: 1 },
            ]);
          if (cycle === 3) return createMockQueryBuilder(eventsResult);
        }
        return createMockQueryBuilder([]);
      }),
    });

    const txInsertQb = createMockQueryBuilder([orderResult]);
    mockTx.insert = jest.fn().mockReturnValue(txInsertQb);

    const txUpdateQb = createMockQueryBuilder([orderResult]);
    mockTx.update = jest.fn().mockReturnValue(txUpdateQb);

    mockTx.delete = jest.fn().mockReturnValue(createMockQueryBuilder([]));

    mockDb.transaction = jest
      .fn()
      .mockImplementation(async (cb: any) => cb(mockTx));
    return mockTx;
  }

  function mockSelectChain(
    responses: Record<number, any[]>,
    fallback: any[] = [],
  ) {
    let call = 0;
    mockDb.select = jest.fn().mockReturnValue({
      from: jest.fn().mockImplementation(() => {
        call++;
        const data = responses[call] ?? fallback;
        const qb = createMockQueryBuilder(data);
        qb.leftJoin = jest.fn().mockReturnValue(qb);
        return qb;
      }),
    });
  }

  let mockSuppliersService: any;
  let mockTaxCategoriesService: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockDb = createMockDb();
    mockInventoryService = {
      recordInventoryMovement: jest.fn().mockResolvedValue(undefined),
    };
    mockSuppliersService = {
      findOne: jest.fn().mockResolvedValue({
        isPurchasingBlocked: false,
        groupIsPurchasingBlocked: false,
      }),
    };
    mockTaxCategoriesService = {
      getDefault: jest
        .fn()
        .mockResolvedValue({ taxCategoryId: 'tax-default', rate: '10.00' }),
      findOneByCode: jest.fn().mockImplementation((code) => {
        if (code === 'GST-20')
          return Promise.resolve({ taxCategoryId: 'tax-20', rate: '20.00' });
        return Promise.resolve(null);
      }),
      getById: jest
        .fn()
        .mockResolvedValue({ taxCategoryId: 'tax-default', rate: '10.00' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchaseOrdersService,
        { provide: DRIZZLE, useValue: mockDb },
        { provide: InventoryService, useValue: mockInventoryService },
        { provide: SuppliersService, useValue: mockSuppliersService },
        { provide: TaxCategoriesService, useValue: mockTaxCategoriesService },
        {
          provide: AppConfigService,
          useValue: { homeCurrency: jest.fn().mockReturnValue('EUR') },
        },
      ],
    }).compile();

    service = module.get<PurchaseOrdersService>(PurchaseOrdersService);
  });

  describe('create', () => {
    const validDto = {
      orderNumber: 'PO-001',
      name: 'Office Supplies',
      vendorId: 'v-001',
      deliveryLocationId: 'loc-1',
      currencyCode: 'EUR',
      lines: [
        {
          productId: 'P1',
          quantity: '10',
          pricePerUnit: '5',
          discountPercentage: '10',
        },
      ],
    };

    it('should create a purchase order with lines and trigger an event', async () => {
      const dbOrder = {
        purchaseOrderId: 'po-1',
        stateCode: 'draft',
        orderNumber: 'PO-001',
      };
      const tx = mockTransaction(dbOrder, [], [], true);

      const result = await service.create(validDto, 'admin');

      expect(result).toBeDefined();
      expect(result.salesOrderId).toBe('po-1'); // mapped field
      expect(result.stateCode).toBe('draft');
      expect(mockDb.transaction).toHaveBeenCalled();

      // Inserts into purchaseOrders, purchaseOrderLineItems, events
      expect(tx.insert).toHaveBeenCalledTimes(3);
    });

    it('should create an empty purchase order when no lines provided', async () => {
      const dbOrder = {
        purchaseOrderId: 'po-2',
        stateCode: 'draft',
        orderNumber: 'PO-002',
      };
      const tx = mockTransaction(dbOrder, [], [], true);

      await service.create({ ...validDto, lines: [] }, 'admin');
      // Only purchaseOrders and events inserts
      expect(tx.insert).toHaveBeenCalledTimes(2);
    });
  });

  describe('findAll', () => {
    it('should return paginated and mapped purchase orders', async () => {
      mockSelectChain({
        1: [
          {
            id: 'po-1',
            orderNumber: 'PO-001',
            stateCode: 'draft',
            currencyCode: 'EUR',
          },
        ],
        2: [{ purchaseOrderId: 'po-1', total: '150.00' }],
      });

      const result = await service.findAll();
      expect(result.data).toHaveLength(1);
      expect(result.data[0].totalPrice).toBe('150.00');
      expect(result.total).toBe(1);
    });

    it('should apply search filters and handle missing line amounts securely', async () => {
      mockSelectChain({
        1: [{ id: 'po-2', orderNumber: 'PO-002', stateCode: 'confirmed' }],
        2: [], // no line items found
      });

      const result = await service.findAll({
        q: 'supplies',
        state: 'confirmed',
      });
      expect(result.data).toHaveLength(1);
      expect(result.data[0].totalPrice).toBeNull();
    });
  });

  describe('findOne', () => {
    it('should find order by id and return mapped structure', async () => {
      mockSelectChain({
        1: [{ purchaseOrderId: 'po-1', orderNumber: 'PO-001' }],
        2: [{ purchaseOrderLineId: 'line-1', productId: 'p1' }], // lines
        3: [{ productId: 'p1', uomCode: 'EA', divisor: 1 }], // product UOMs lookup
        4: [{ eventType: 'created' }], // events
      });

      const result = await service.findOne('po-1');
      expect(result).toBeDefined();
      expect(result.salesOrderId).toBe('po-1');
      expect(result.lines).toHaveLength(1);
      expect(result.events).toHaveLength(1);
    });

    it('should throw NotFoundException if order does not exist', async () => {
      mockSelectChain({ 1: [] });
      await expect(service.findOne('bad-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('changeState', () => {
    it('should reject invalid state transitions', async () => {
      mockSelectChain({ 1: [{ purchaseOrderId: 'po-1', stateCode: 'draft' }] });
      mockTransaction({ purchaseOrderId: 'po-1', stateCode: 'draft' });
      await expect(service.changeState('po-1', 'received')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject invalid generic states', async () => {
      await expect(
        service.changeState('po-1', 'does_not_exist'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should successfully change state to an allowed state', async () => {
      mockSelectChain({
        1: [
          {
            purchaseOrderId: 'po-1',
            stateCode: 'draft',
            deliveryLocationId: 'loc-1',
          },
        ],
      });
      const tx = mockTransaction({
        purchaseOrderId: 'po-1',
        stateCode: 'ordered',
      });
      const result = await service.changeState('po-1', 'ordered');
      expect(result).toBeDefined();
      expect(tx.update).toHaveBeenCalled();
    });
  });

  describe('archive flow', () => {
    it('should reject archiving an invalid state order', async () => {
      mockSelectChain({ 1: [{ purchaseOrderId: 'po-1', stateCode: 'draft' }] });
      mockTransaction({ purchaseOrderId: 'po-1', stateCode: 'draft' });
      await expect(service.archive('po-1', 'admin')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should archive a valid received order', async () => {
      mockSelectChain({
        1: [{ purchaseOrderId: 'po-1', stateCode: 'received' }],
      });
      const tx = mockTransaction({
        purchaseOrderId: 'po-1',
        stateCode: 'archived',
      });
      const res = await service.archive('po-1', 'admin');
      expect(res).toBeDefined();
      expect(tx.update).toHaveBeenCalled();
    });

    it('should unarchive an archived order to cancelled', async () => {
      mockSelectChain({
        1: [{ purchaseOrderId: 'po-1', stateCode: 'archived' }],
      });
      const tx = mockTransaction({
        purchaseOrderId: 'po-1',
        stateCode: 'cancelled',
      });
      const res = await service.unarchive('po-1', 'admin');
      expect(res).toBeDefined();
      expect(tx.update).toHaveBeenCalled();
    });

    it('should reject unarchiving an active order', async () => {
      mockSelectChain({ 1: [{ purchaseOrderId: 'po-1', stateCode: 'draft' }] });
      mockTransaction({ purchaseOrderId: 'po-1', stateCode: 'draft' });
      await expect(service.unarchive('po-1', 'admin')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('line items management', () => {
    const orderLinesResult = [
      {
        purchaseOrderLineId: 'line-1',
        lineNumber: 1,
        quantity: '5',
        pricePerUnit: '10',
      },
    ];

    it('should add a line item and increment the max line number', async () => {
      mockSelectChain({
        1: [{ purchaseOrderId: 'po-1', stateCode: 'draft' }],
        2: orderLinesResult,
        3: [],
      });
      const tx = mockTransaction(
        { purchaseOrderId: 'po-1', stateCode: 'draft' },
        orderLinesResult,
      );

      const result = await service.addLine('po-1', {
        productId: 'P2',
        quantity: '2',
        pricePerUnit: '20',
      });
      expect(result).toBeDefined();
      expect(tx.insert).toHaveBeenCalledTimes(2); // One for line, one for event
    });

    it('should update a line item recalculating prices', async () => {
      mockSelectChain({
        1: [{ purchaseOrderId: 'po-1', stateCode: 'draft' }],
        2: orderLinesResult,
        3: [],
      });
      const tx = mockTransaction(
        { purchaseOrderId: 'po-1', stateCode: 'draft' },
        orderLinesResult,
      );

      const result = await service.updateLine('po-1', 'line-1', {
        quantity: '10',
      });
      expect(result).toBeDefined();
      expect(tx.update).toHaveBeenCalled();
    });

    it('should remove a line item', async () => {
      mockSelectChain({
        1: [{ purchaseOrderId: 'po-1', stateCode: 'draft' }],
        2: orderLinesResult,
        3: [],
      });
      const tx = mockTransaction(
        { purchaseOrderId: 'po-1', stateCode: 'draft' },
        orderLinesResult,
      );

      const result = await service.removeLine('po-1', 'line-1');
      expect(result).toBeDefined();
      expect(tx.delete).toHaveBeenCalled();
    });

    it('should throw bad request when modifying lines of a non-draft order', async () => {
      mockTransaction({ purchaseOrderId: 'po-1', stateCode: 'ordered' });
      await expect(service.addLine('po-1', {})).rejects.toThrow(
        BadRequestException,
      );
      mockTransaction({ purchaseOrderId: 'po-1', stateCode: 'ordered' });
      await expect(service.updateLine('po-1', 'line-1', {})).rejects.toThrow(
        BadRequestException,
      );
      mockTransaction({ purchaseOrderId: 'po-1', stateCode: 'ordered' });
      await expect(service.removeLine('po-1', 'line-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findPendingLines', () => {
    it('should query pending line items for a given productId', async () => {
      mockSelectChain({
        2: [
          {
            purchaseOrderId: 'po-1',
            orderNumber: 'PO-001',
            stateCode: 'ordered',
            purchaseOrderLineId: 'l1',
            quantity: '10',
            quantityReceived: '0',
          },
        ],
      });

      const result = await service.findPendingLines('p1');
      expect(result).toBeDefined();
      expect(result).toHaveLength(1);
      expect(result[0].purchaseOrderLineId).toBe('l1');
    });

    it('should throw BadRequestException if productId is not provided', async () => {
      await expect(service.findPendingLines('')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
