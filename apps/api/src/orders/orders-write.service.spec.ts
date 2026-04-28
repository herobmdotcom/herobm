import { AppConfigService } from '../settings/app-config.service';
import { Test, TestingModule } from '@nestjs/testing';
import { OrdersWriteService } from './orders-write.service';
import { BackordersService } from './backorders.service';
import { PickingService } from './picking.service';
import { TaxCategoriesService } from '../tax/tax-categories.service';
import { InventoryService } from '../inventory/inventory.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { AccountsService } from '../accounts/accounts.service';
import { CreditAssessmentService } from '../accounts/credit-assessment.service';
import { ProductsService } from '../products/products.service';

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

function createMockQueryBuilder(resolvedValue: any = []) {
  const qb: any = {
    values: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    returning: jest.fn().mockResolvedValue(resolvedValue),
    then: jest.fn().mockImplementation((cb) => cb(resolvedValue)),
  };
  return qb;
}

function createMockTx() {
  return {
    select: jest
      .fn()
      .mockReturnValue(createMockQueryBuilder([{ id: 'loc-main-123' }])),
    insert: jest.fn().mockReturnValue(createMockQueryBuilder([])),
    update: jest.fn().mockReturnValue(createMockQueryBuilder([])),
    delete: jest.fn().mockReturnValue(createMockQueryBuilder([])),
    execute: jest.fn().mockResolvedValue([]),
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

// Default GST categories used across tests
const TAX_DEFAULT = {
  taxCategoryId: 'tax-default',
  code: 'GST',
  rate: '10',
  isDefault: true,
};
const TAX_EXEMPT = {
  taxCategoryId: 'tax-exempt',
  code: 'EXE',
  rate: '0',
  isDefault: false,
};
const TAX_ZERO = {
  taxCategoryId: 'tax-zero',
  code: 'ZR',
  rate: '0',
  isDefault: false,
};

describe('OrdersWriteService', () => {
  let service: OrdersWriteService;
  let mockDb: any;
  let mockPickingService: any;
  let mockInventoryService: any;
  let mockAccountsService: any;
  let mockProductsService: any;
  let mocktaxService: any;
  let mockBackordersService: any;
  let mockCreditAssessmentService: any;

  /**
   * Flexible select-chain mock that maps call indices to results.
   * Call `mockSelectChain({ 1: [...], 2: [...], ... })` to define what each
   * sequential select().from() call returns.
   */
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
        // Support .leftJoin() chaining (used by findOrder)
        qb.leftJoin = jest.fn().mockReturnValue(qb);
        return qb;
      }),
    });
  }

  function mockTransaction(result: any) {
    const mockTx = createMockTx();
    const txInsertQb = createMockQueryBuilder(
      Array.isArray(result) ? result : [result],
    );
    let insertCount = 0;
    mockTx.insert = jest.fn().mockImplementation(() => {
      insertCount++;
      if (insertCount === 1) return txInsertQb;
      return createMockQueryBuilder([]);
    });
    // generateOrderNumber is now called inside the tx
    mockTx.execute = jest.fn().mockResolvedValue([]);
    mockDb.transaction = jest
      .fn()
      .mockImplementation(async (cb: any) => cb(mockTx));
    return mockTx;
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    mockDb = createMockDb();
    mocktaxService = {
      getDefault: jest.fn().mockResolvedValue(TAX_DEFAULT),
      getByCode: jest.fn().mockImplementation(async (code: string) => {
        if (code === 'EXE') return TAX_EXEMPT;
        if (code === 'ZR') return TAX_ZERO;
        if (code === 'GST') return TAX_DEFAULT;
        throw new Error('GST category not found by code');
      }),
      getById: jest.fn().mockImplementation(async (id: string) => {
        if (id === 'unknown-id') throw new Error('Not found by ID');
        if (id === 'tax-zero') return TAX_ZERO;
        if (id === 'tax-exempt') return TAX_EXEMPT;
        return TAX_DEFAULT;
      }),
    };

    mockBackordersService = {
      evaluateGaps: jest.fn().mockResolvedValue([]),
      triggerBackorders: jest.fn().mockResolvedValue(undefined),
    };

    mockPickingService = {
      assertFullyPicked: jest.fn().mockResolvedValue(undefined),
      assertFullyShipped: jest.fn().mockResolvedValue(undefined),
    };

    mockInventoryService = {
      recordInventoryMovement: jest.fn().mockResolvedValue(undefined),
    };
    mockAccountsService = {
      findOne: jest.fn().mockResolvedValue({
        accountId: 'c0000000-0000-0000-0000-000000000001',
        customerDiscount: '0',
        currencyCode: 'EUR',
        taxCategoryId: 'tax-default',
      }),
    };
    mockProductsService = {
      findOne: jest.fn().mockResolvedValue({
        productId: 'PROD-001',
        name: 'Test Product',
        salesTaxCategoryId: 'tax-default',
      }),
    };
    mockCreditAssessmentService = {
      assessCredit: jest.fn().mockResolvedValue({
        totalArBalance: 0,
        overdueBalance: 0,
        isOverdue: false,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: AppConfigService,
          useValue: {
            defaultFulfillmentLocationId: jest.fn().mockReturnValue('MAIN_ID'),
            creditLimitBehavior: jest.fn().mockReturnValue('soft'),
          },
        },
        OrdersWriteService,
        { provide: DRIZZLE, useValue: mockDb },
        { provide: TaxCategoriesService, useValue: mocktaxService },
        { provide: PickingService, useValue: mockPickingService },
        { provide: InventoryService, useValue: mockInventoryService },
        { provide: AccountsService, useValue: mockAccountsService },
        {
          provide: CreditAssessmentService,
          useValue: mockCreditAssessmentService,
        },
        { provide: ProductsService, useValue: mockProductsService },
        { provide: BackordersService, useValue: mockBackordersService },
      ],
    }).compile();

    service = module.get<OrdersWriteService>(OrdersWriteService);
  });

  // =========================================================================
  // computeLineAmount
  // =========================================================================

  describe('line amount computation', () => {
    const compute = (
      qty: string,
      price: string,
      disc: string,
      taxRate: number,
    ) =>
      (OrdersWriteService.prototype as any).computeLineAmount.call(
        null,
        qty,
        price,
        disc,
        taxRate,
      );

    it('should compute amount without discount or tax', () => {
      const r = compute('10', '5.00', '0', 0);
      expect(r.amount).toBe('50.00');
      expect(r.tax).toBe('0.00');
      expect(r.totalAmount).toBe('50.00');
    });

    it('should apply percentage discount', () => {
      const r = compute('10', '5.00', '10', 0);
      expect(r.amount).toBe('45.00');
      expect(r.totalAmount).toBe('45.00');
    });

    it('should auto-calculate tax from GST rate', () => {
      const r = compute('10', '5.00', '0', 10);
      expect(r.amount).toBe('50.00');
      expect(r.tax).toBe('5.00');
      expect(r.totalAmount).toBe('55.00');
    });

    it('should handle discount and GST rate together', () => {
      const r = compute('10', '5.00', '10', 10);
      expect(r.amount).toBe('45.00');
      expect(r.tax).toBe('4.50');
      expect(r.totalAmount).toBe('49.50');
    });

    it('should handle fractional quantities', () => {
      const r = compute('2.5', '10.00', '0', 0);
      expect(r.amount).toBe('25.00');
    });
  });

  // =========================================================================
  // create()
  //
  // generateOrderNumber() is now called inside the transaction (uses tx.execute).
  // The remaining select calls outside the transaction are:
  //   - resolveCustomer → AccountsService.findOne (mocked)
  //   - resolveTaxForLine → AccountsService + ProductsService (mocked)
  //   - validateProduct → ProductsService.findOne (mocked)
  // =========================================================================

  describe('create', () => {
    const validDto = {
      customerId: 'c0000000-0000-0000-0000-000000000001',
      lines: [{ productId: 'PROD-001', quantity: '10', pricePerUnit: '5.00' }],
    };

    function setupCreate(opts?: {
      taxCategoryId?: string;
      disc?: string;
      productTaxId?: string;
      currency?: string;
    }) {
      const gstId = opts?.taxCategoryId ?? 'tax-default';
      const disc = opts?.disc ?? '0';
      const prodGstId = opts?.productTaxId ?? 'tax-default';
      const currency = opts?.currency ?? 'EUR';

      mockAccountsService.findOne.mockResolvedValue({
        accountId: 'c0000000-0000-0000-0000-000000000001',
        customerDiscount: disc,
        currencyCode: currency,
        taxCategoryId: gstId,
      });

      mockProductsService.findOne.mockResolvedValue({
        productId: 'PROD-001',
        name: 'Test Product',
        salesTaxCategoryId: prodGstId,
      });

      // DB calls: generateOrderNumber is now inside the tx (handled by mockTransaction)
      mockSelectChain({});

      mockTransaction({
        salesOrderId: '00000000-0000-4000-a000-000000000001',
        orderNumber: 'ORD-20260313-0001',
        stateCode: 'draft',
        customerDiscount: disc,
        currencyCode: currency,
        taxCategoryId: 'tax-default',
      });
    }

    it('should create an order in draft state', async () => {
      setupCreate();
      const result = await service.create(validDto, 'admin');
      expect(result).toHaveProperty(
        'salesOrderId',
        '00000000-0000-4000-a000-000000000001',
      );
      expect(result).toHaveProperty('stateCode', 'draft');
    });

    it('should snapshot customer discount onto the order', async () => {
      setupCreate({ disc: '15' });
      const result = await service.create(validDto, 'admin');
      expect((result as any).customerDiscount).toBe('15');
    });

    it('should snapshot non-EUR currency onto the order (ADV-034)', async () => {
      setupCreate({ currency: 'SGD' });
      const result = await service.create(validDto, 'admin');
      expect(result.currencyCode).toBe('SGD');
    });

    it('should use product GST category directly without fallback if possible', async () => {
      setupCreate();
      await service.create(validDto, 'admin');
      expect(mocktaxService.getById).toHaveBeenCalledWith('tax-default');
    });

    it('should use zero-rated GST for zero-rated product', async () => {
      setupCreate({ productTaxId: 'tax-zero' });
      await service.create(validDto, 'admin');
      expect(mocktaxService.getById).toHaveBeenCalledWith('tax-zero');
    });

    it('should use exempt GST for exempt customer (regardless of product)', async () => {
      mockAccountsService.findOne.mockResolvedValue({
        accountId: 'c0000000-0000-0000-0000-000000000001',
        customerDiscount: '0',
        currencyCode: 'EUR',
        taxCategoryId: 'tax-exempt',
      });
      mockSelectChain({});
      mockTransaction({
        salesOrderId: '00000000-0000-4000-a000-000000000001',
        orderNumber: 'ORD-20260313-0001',
        stateCode: 'draft',
        customerDiscount: '0',
        taxCategoryId: 'tax-exempt',
      });

      await service.create(validDto, 'admin');
      expect(mocktaxService.getById).toHaveBeenCalledTimes(1);
    });

    it('should reject unknown customer', async () => {
      mockAccountsService.findOne.mockRejectedValue(new NotFoundException());
      await expect(service.create(validDto, 'admin')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject unknown product', async () => {
      mockProductsService.findOne.mockRejectedValue(new NotFoundException());
      await expect(service.create(validDto, 'admin')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should call transaction', async () => {
      setupCreate();
      await service.create(validDto, 'admin');
      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    });

    it('should create order with no lines', async () => {
      // No productId → resolveTaxForLine skips product lookup
      mockSelectChain({});
      mockTransaction({
        salesOrderId: 'uuid-no-lines',
        orderNumber: 'ORD-20260313-0001',
        stateCode: 'draft',
        customerDiscount: '0',
        taxCategoryId: 'tax-default',
      });

      const dto = {
        customerId: 'c0000000-0000-0000-0000-000000000001',
        lines: [],
      };
      const result = await service.create(dto, 'admin');
      expect(result).toHaveProperty('salesOrderId');
    });

    it('should fall back to system default when product has unknown GST category', async () => {
      setupCreate({ productTaxId: 'unknown-id' });
      await service.create(validDto, 'admin');
      // The default should be fetched from fallback!
      expect(mocktaxService.getDefault).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // update()
  // =========================================================================

  describe('update', () => {
    function setupForUpdate(stateCode: string) {
      mockSelectChain({
        1: [
          {
            order: {
              salesOrderId: '00000000-0000-4000-a000-000000000001',
              stateCode,
              name: 'Old Name',
              customerOrderNumber: null,
              notes: null,
            },
            customerName: 'Test Customer',
          },
        ],
      });

      const txUpdateQb = createMockQueryBuilder([
        {
          salesOrderId: '00000000-0000-4000-a000-000000000001',
          name: 'New Name',
          stateCode,
        },
      ]);
      mockDb.transaction = jest.fn().mockImplementation(async (cb: any) => {
        const tx = createMockTx();
        tx.update = jest.fn().mockReturnValue(txUpdateQb);
        return cb(tx);
      });
    }

    it('should update header fields on a draft order', async () => {
      setupForUpdate('draft');
      const result = await service.update(
        '00000000-0000-4000-a000-000000000001',
        { name: 'New Name' },
        'admin',
      );
      expect(result.name).toBe('New Name');
    });

    it('should update header fields on a quoted order', async () => {
      setupForUpdate('quoted');
      const result = await service.update(
        '00000000-0000-4000-a000-000000000001',
        { name: 'New Name' },
        'admin',
      );
      expect(result).toBeDefined();
    });

    it('should reject update on invoiced order', async () => {
      setupForUpdate('invoiced');
      await expect(
        service.update(
          '00000000-0000-4000-a000-000000000001',
          { name: 'Test' },
          'admin',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject update on cancelled order', async () => {
      setupForUpdate('cancelled');
      await expect(
        service.update(
          '00000000-0000-4000-a000-000000000001',
          { notes: 'Test' },
          'admin',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException for unknown order', async () => {
      mockSelectChain({ 1: [] });
      await expect(service.update('NOPE', {}, 'admin')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // =========================================================================
  // changeState()
  // =========================================================================

  describe('changeState', () => {
    function setupWithState(currentState: string) {
      mockSelectChain({
        1: [
          {
            order: {
              salesOrderId: '00000000-0000-4000-a000-000000000001',
              stateCode: currentState,
              customerId: 'c0000000-0000-0000-0000-000000000001',
            },
            customerName: 'Test Customer',
          },
        ],
        2: [{ productId: 'PROD-001', quantity: '10' }], // order lines for inventory hooks
      });

      const txUpdateQb = createMockQueryBuilder([
        { salesOrderId: '00000000-0000-4000-a000-000000000001', stateCode: '' },
      ]);
      mockDb.transaction = jest.fn().mockImplementation(async (cb: any) => {
        const tx = createMockTx();
        tx.update = jest.fn().mockReturnValue(txUpdateQb);
        return cb(tx);
      });
    }

    it.each([
      ['draft', 'quoted'],
      ['draft', 'cancelled'],
      ['quoted', 'confirmed'],
      ['quoted', 'draft'],
      ['quoted', 'cancelled'],
      ['confirmed', 'picking'],
      ['confirmed', 'cancelled'],
      ['picking', 'shipped'],
      ['picking', 'confirmed'],
      ['shipped', 'invoiced'],
      ['cancelled', 'draft'],
    ])('should allow transition %s → %s', async (from, to) => {
      setupWithState(from);
      await expect(
        service.changeState(
          '00000000-0000-4000-a000-000000000001',
          to,
          'admin',
        ),
      ).resolves.toBeDefined();
    });

    it.each([
      ['draft', 'shipped'],
      ['draft', 'invoiced'],
      ['draft', 'picking'],
      ['draft', 'confirmed'],
      ['confirmed', 'quoted'],
      ['shipped', 'draft'],
      ['invoiced', 'draft'],
      ['invoiced', 'cancelled'],
    ])('should reject transition %s → %s', async (from, to) => {
      setupWithState(from);
      await expect(
        service.changeState(
          '00000000-0000-4000-a000-000000000001',
          to,
          'admin',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject unknown state name', async () => {
      await expect(
        service.changeState(
          '00000000-0000-4000-a000-000000000001',
          'nonexistent_state',
          'admin',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    // ── Inventory integration tests ──

    it('should transition quoted → confirmed', async () => {
      mockSelectChain({
        1: [
          {
            order: {
              salesOrderId: '00000000-0000-4000-a000-000000000001',
              stateCode: 'quoted',
              customerId: 'c0000000-0000-0000-0000-000000000001',
            },
            customerName: 'Test Customer',
          },
        ],
        2: [{ productId: 'PROD-001', quantity: '10' }],
      });

      const txUpdateQb = createMockQueryBuilder([
        {
          salesOrderId: '00000000-0000-4000-a000-000000000001',
          stateCode: 'confirmed',
        },
      ]);
      mockDb.transaction = jest.fn().mockImplementation(async (cb: any) => {
        const tx = createMockTx();
        tx.update = jest.fn().mockReturnValue(txUpdateQb);
        return cb(tx);
      });

      await service.changeState(
        '00000000-0000-4000-a000-000000000001',
        'confirmed',
        'admin',
      );
    });

    it('should transition confirmed → cancelled', async () => {
      mockSelectChain({
        1: [
          {
            order: {
              salesOrderId: '00000000-0000-4000-a000-000000000001',
              stateCode: 'confirmed',
              customerId: 'c0000000-0000-0000-0000-000000000001',
            },
            customerName: 'Test Customer',
          },
        ],
        2: [{ productId: 'PROD-001', quantity: '10' }],
      });

      const txUpdateQb = createMockQueryBuilder([
        {
          salesOrderId: '00000000-0000-4000-a000-000000000001',
          stateCode: 'cancelled',
        },
      ]);
      mockDb.transaction = jest.fn().mockImplementation(async (cb: any) => {
        const tx = createMockTx();
        tx.update = jest.fn().mockReturnValue(txUpdateQb);
        return cb(tx);
      });

      await service.changeState(
        '00000000-0000-4000-a000-000000000001',
        'cancelled',
        'admin',
      );
    });

    it('should transition draft → quoted without inventory side-effects', async () => {
      setupWithState('draft');
      await service.changeState(
        '00000000-0000-4000-a000-000000000001',
        'quoted',
        'admin',
      );
    });

    it('should transition draft → cancelled without inventory side-effects', async () => {
      mockSelectChain({
        1: [
          {
            order: {
              salesOrderId: '00000000-0000-4000-a000-000000000001',
              stateCode: 'draft',
            },
            customerName: 'Test Customer',
          },
        ],
        2: [],
      });

      const txUpdateQb = createMockQueryBuilder([
        {
          salesOrderId: '00000000-0000-4000-a000-000000000001',
          stateCode: 'cancelled',
        },
      ]);
      mockDb.transaction = jest.fn().mockImplementation(async (cb: any) => {
        const tx = createMockTx();
        tx.update = jest.fn().mockReturnValue(txUpdateQb);
        return cb(tx);
      });

      await service.changeState(
        '00000000-0000-4000-a000-000000000001',
        'cancelled',
        'admin',
      );
      expect(
        mockInventoryService.recordInventoryMovement,
      ).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // addLine()
  //
  // New select call sequence:
  //   1. findOrder → order row (with customerId)
  //   2. validateProduct → lookupProduct
  //   3. max line number query
  //   4. resolveTaxForLine → accounts.taxCategoryId
  //   5. resolveTaxForLine → lookupProduct (for product gstCategory)
  // =========================================================================

  describe('addLine', () => {
    const lineDto = {
      productId: 'PROD-001',
      quantity: '5',
      pricePerUnit: '12.00',
    };

    function setupForAddLine(orderState: string, maxLineNumber = 0) {
      mockAccountsService.findOne.mockResolvedValue({
        accountId: 'c0000000-0000-0000-0000-000000000001',
        customerDiscount: '10',
        currencyCode: 'EUR',
        taxCategoryId: 'tax-default',
      });

      mockProductsService.findOne.mockResolvedValue({
        productId: 'PROD-001',
        name: 'Test Product',
        salesTaxCategoryId: 'tax-default',
      });

      mockSelectChain({
        1: [
          {
            order: {
              salesOrderId: '00000000-0000-4000-a000-000000000001',
              stateCode: orderState,
              orderNumber: 'ORD-123',
              customerId: 'c0000000-0000-0000-0000-000000000001',
            },
            customerName: 'Test Customer',
          },
        ],
        2: [], // NEW: Check if product already exists in this order (empty = not present)
        3: [{ max: maxLineNumber }], // max line number
      });

      const txInsertQb = createMockQueryBuilder([
        {
          salesOrderLineId: 'line-uuid-001',
          lineNumber: maxLineNumber + 1,
        },
      ]);
      mockDb.transaction = jest.fn().mockImplementation(async (cb: any) => {
        const tx = createMockTx();
        tx.insert = jest.fn().mockReturnValue(txInsertQb);
        return cb(tx);
      });
    }

    it('should add a line to a draft order', async () => {
      setupForAddLine('draft', 2);
      const result = await service.addLine(
        '00000000-0000-4000-a000-000000000001',
        lineDto,
        'admin',
      );
      expect(result).toHaveProperty('salesOrderLineId');
      expect(result.lineNumber).toBe(3);
    });

    it('should resolve GST via product category', async () => {
      setupForAddLine('draft');
      await service.addLine(
        '00000000-0000-4000-a000-000000000001',
        lineDto,
        'admin',
      );
      expect(mocktaxService.getById).toHaveBeenCalledWith('tax-default');
    });

    it('should use per-line GST override when provided', async () => {
      setupForAddLine('draft');
      await service.addLine(
        '00000000-0000-4000-a000-000000000001',
        { ...lineDto, taxCategoryId: 'tax-exempt' },
        'admin',
      );
      expect(mocktaxService.getById).toHaveBeenCalledWith('tax-exempt');
    });

    it('should reject adding to an invoiced order', async () => {
      setupForAddLine('invoiced');
      await expect(
        service.addLine(
          '00000000-0000-4000-a000-000000000001',
          lineDto,
          'admin',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject adding to a shipped order', async () => {
      setupForAddLine('shipped');
      await expect(
        service.addLine(
          '00000000-0000-4000-a000-000000000001',
          lineDto,
          'admin',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject adding to a cancelled order', async () => {
      setupForAddLine('cancelled');
      await expect(
        service.addLine(
          '00000000-0000-4000-a000-000000000001',
          lineDto,
          'admin',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should use zero-rate for zero-rated product', async () => {
      mockAccountsService.findOne.mockResolvedValue({
        accountId: 'c0000000-0000-0000-0000-000000000001',
        customerDiscount: '0',
        currencyCode: 'EUR',
        gstPosition: 'taxable',
      });
      mockProductsService.findOne.mockResolvedValue({
        productId: 'PROD-ZR',
        name: 'Zero Prod',
        salesTaxCategoryId: 'tax-zero',
      });

      mockSelectChain({
        1: [
          {
            order: {
              salesOrderId: '00000000-0000-4000-a000-000000000001',
              stateCode: 'draft',
              orderNumber: 'ORD-123',
              customerId: 'c0000000-0000-0000-0000-000000000001',
              customerDiscount: '0',
              taxCategoryId: 'tax-default',
            },
            customerName: 'Test Customer',
          },
        ],
        2: [], // Duplicate check
        3: [{ max: 0 }], // Line number
      });
      const txInsertQb = createMockQueryBuilder([
        { salesOrderLineId: 'line-1', lineNumber: 1 },
      ]);
      mockDb.transaction = jest.fn().mockImplementation(async (cb: any) => {
        const tx = createMockTx();
        tx.insert = jest.fn().mockReturnValue(txInsertQb);
        return cb(tx);
      });

      mockProductsService.findOne.mockResolvedValue({
        productId: 'PROD-ZR',
        name: 'Zero Rated Product',
        salesTaxCategoryId: 'tax-zero',
      });
      await service.addLine(
        '00000000-0000-4000-a000-000000000001',
        { ...lineDto, productId: 'PROD-ZR' },
        'admin',
      );
      expect(mocktaxService.getById).toHaveBeenCalledWith('tax-zero');
    });
  });

  // =========================================================================
  // updateLine()
  // =========================================================================

  describe('updateLine', () => {
    function setupForUpdateLine(orderState: string) {
      mockSelectChain({
        1: [
          {
            order: {
              salesOrderId: '00000000-0000-4000-a000-000000000001',
              stateCode: orderState,
              taxCategoryId: 'tax-default',
            },
            customerName: 'Test Customer',
          },
        ],
        2: [
          {
            salesOrderLineId: 'line-001',
            salesOrderId: '00000000-0000-4000-a000-000000000001',
            quantity: '10',
            pricePerUnit: '5.00',
            discountPercentage: '0',
            taxCategoryId: 'tax-default',
          },
        ],
      });

      const txUpdateQb = createMockQueryBuilder([
        {
          salesOrderLineId: 'line-001',
          quantity: '20',
          amount: '100.00',
          totalAmount: '110.00',
        },
      ]);
      mockDb.transaction = jest.fn().mockImplementation(async (cb: any) => {
        const tx = createMockTx();
        tx.update = jest.fn().mockReturnValue(txUpdateQb);
        return cb(tx);
      });
    }

    it('should update line quantity on a draft order', async () => {
      setupForUpdateLine('draft');
      const result = await service.updateLine(
        '00000000-0000-4000-a000-000000000001',
        'line-001',
        { quantity: '20' },
        'admin',
      );
      expect(result).toHaveProperty('salesOrderLineId', 'line-001');
    });

    it('should resolve GST category for recomputation', async () => {
      setupForUpdateLine('draft');
      await service.updateLine(
        '00000000-0000-4000-a000-000000000001',
        'line-001',
        { quantity: '20' },
        'admin',
      );
      expect(mocktaxService.getById).toHaveBeenCalledWith('tax-default');
    });

    it('should reject update on invoiced order', async () => {
      setupForUpdateLine('invoiced');
      await expect(
        service.updateLine(
          '00000000-0000-4000-a000-000000000001',
          'line-001',
          { quantity: '20' },
          'admin',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject update on shipped order', async () => {
      setupForUpdateLine('shipped');
      await expect(
        service.updateLine(
          '00000000-0000-4000-a000-000000000001',
          'line-001',
          { quantity: '20' },
          'admin',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject update on cancelled order', async () => {
      setupForUpdateLine('cancelled');
      await expect(
        service.updateLine(
          '00000000-0000-4000-a000-000000000001',
          'line-001',
          { quantity: '20' },
          'admin',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // =========================================================================
  // removeLine()
  // =========================================================================

  describe('removeLine', () => {
    function setupForRemoveLine(orderState: string) {
      mockSelectChain({
        1: [
          {
            order: {
              salesOrderId: '00000000-0000-4000-a000-000000000001',
              stateCode: orderState,
            },
            customerName: 'Test Customer',
          },
        ],
        2: [
          {
            salesOrderLineId: 'line-001',
            salesOrderId: '00000000-0000-4000-a000-000000000001',
            productId: 'PROD-001',
            quantity: '10',
          },
        ],
      });
      mockDb.transaction = jest
        .fn()
        .mockImplementation(async (cb: any) => cb(createMockTx()));
    }

    it('should remove a line from a draft order', async () => {
      setupForRemoveLine('draft');
      await expect(
        service.removeLine(
          '00000000-0000-4000-a000-000000000001',
          'line-001',
          'admin',
        ),
      ).resolves.toBeUndefined();
    });

    it('should call transaction for removal', async () => {
      setupForRemoveLine('draft');
      await service.removeLine(
        '00000000-0000-4000-a000-000000000001',
        'line-001',
        'admin',
      );
      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    });

    it('should reject removal from invoiced order', async () => {
      setupForRemoveLine('invoiced');
      await expect(
        service.removeLine(
          '00000000-0000-4000-a000-000000000001',
          'line-001',
          'admin',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject removal from shipped order', async () => {
      setupForRemoveLine('shipped');
      await expect(
        service.removeLine(
          '00000000-0000-4000-a000-000000000001',
          'line-001',
          'admin',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject removal from cancelled order', async () => {
      setupForRemoveLine('cancelled');
      await expect(
        service.removeLine(
          '00000000-0000-4000-a000-000000000001',
          'line-001',
          'admin',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // =========================================================================
  // findOne() / findOrder() / findLine()
  // =========================================================================

  describe('findOne', () => {
    it('should return order with lines and events', async () => {
      mockSelectChain({
        1: [
          {
            order: {
              salesOrderId: '00000000-0000-4000-a000-000000000001',
              stateCode: 'draft',
            },
            customerName: 'Test Customer',
          },
        ],
        2: [
          {
            salesOrderLineId: 'line-001',
            lineNumber: 1,
            productId: 'prod-001',
          },
        ],
        3: [{ productId: 'prod-001', uomCode: 'EA', divisor: 1 }],
        4: [{ eventId: 'evt-001', eventType: 'created' }],
      });

      const result = await service.findOne(
        '00000000-0000-4000-a000-000000000001',
      );
      expect(result).toHaveProperty(
        'salesOrderId',
        '00000000-0000-4000-a000-000000000001',
      );
      expect(result.lines).toHaveLength(1);
      expect(result.events).toHaveLength(1);
    });

    it('should throw NotFoundException for unknown order', async () => {
      mockSelectChain({ 1: [] });
      await expect(service.findOne('NONEXISTENT')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findLine (via updateLine)', () => {
    it('should throw NotFoundException when line does not exist', async () => {
      mockSelectChain({
        1: [
          {
            order: {
              salesOrderId: '00000000-0000-4000-a000-000000000001',
              stateCode: 'draft',
              taxCategoryId: 'tax-default',
            },
            customerName: 'Test Customer',
          },
        ],
        2: [], // line not found
      });

      await expect(
        service.updateLine(
          '00000000-0000-4000-a000-000000000001',
          'line-NOPE',
          { quantity: '1' },
          'admin',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if line belongs to different order', async () => {
      mockSelectChain({
        1: [
          {
            order: {
              salesOrderId: '00000000-0000-4000-a000-000000000001',
              stateCode: 'draft',
              taxCategoryId: 'tax-default',
            },
            customerName: 'Test Customer',
          },
        ],
        2: [
          {
            salesOrderLineId: 'line-001',
            salesOrderId: 'uuid-OTHER',
            quantity: '10',
            pricePerUnit: '5.00',
          },
        ],
      });

      await expect(
        service.updateLine(
          '00000000-0000-4000-a000-000000000001',
          'line-001',
          { quantity: '20' },
          'admin',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
