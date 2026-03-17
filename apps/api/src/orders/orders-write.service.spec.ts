import { Test, TestingModule } from '@nestjs/testing';
import { OrdersWriteService } from './orders-write.service';
import { PickingService } from './picking.service';
import { GstCategoriesService } from '../gst/gst-categories.service';
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
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    returning: jest.fn().mockResolvedValue(resolvedValue),
    then: jest.fn().mockImplementation((cb) => cb(resolvedValue)),
  };
  return qb;
}

function createMockTx() {
  return {
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

// Default GST categories used across tests
const GST_DEFAULT = {
  gstCategoryId: 'gst-default',
  code: 'GST',
  rate: '10',
  isDefault: true,
};
const GST_EXEMPT = {
  gstCategoryId: 'gst-exempt',
  code: 'EXE',
  rate: '0',
  isDefault: false,
};
const GST_ZERO = {
  gstCategoryId: 'gst-zero',
  code: 'ZR',
  rate: '0',
  isDefault: false,
};

describe('OrdersWriteService', () => {
  let service: OrdersWriteService;
  let mockDb: any;
  let mockGstService: any;
  let mockPickingService: any;
  let mockInventoryService: any;

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
    mockDb.transaction = jest
      .fn()
      .mockImplementation(async (cb: any) => cb(mockTx));
    return mockTx;
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    mockDb = createMockDb();
    mockGstService = {
      getDefault: jest.fn().mockResolvedValue(GST_DEFAULT),
      getByCode: jest.fn().mockImplementation(async (code: string) => {
        if (code === 'EXE') return GST_EXEMPT;
        if (code === 'ZR') return GST_ZERO;
        return GST_DEFAULT;
      }),
      getById: jest.fn().mockResolvedValue(GST_DEFAULT),
    };

    mockPickingService = {
      assertFullyPicked: jest.fn().mockResolvedValue(undefined),
    };

    mockInventoryService = {
      commitStock: jest.fn().mockResolvedValue(undefined),
      releaseStock: jest.fn().mockResolvedValue(undefined),
      deductStock: jest.fn().mockResolvedValue(undefined),
      restoreStock: jest.fn().mockResolvedValue(undefined),
      returnStock: jest.fn().mockResolvedValue(undefined),
      placeOnOrder: jest.fn().mockResolvedValue(undefined),
      cancelOnOrder: jest.fn().mockResolvedValue(undefined),
      receiveStock: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersWriteService,
        { provide: DRIZZLE, useValue: mockDb },
        { provide: GstCategoriesService, useValue: mockGstService },
        { provide: PickingService, useValue: mockPickingService },
        { provide: InventoryService, useValue: mockInventoryService },
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
      gstRate: number,
    ) =>
      (OrdersWriteService.prototype as any).computeLineAmount.call(
        null,
        qty,
        price,
        disc,
        gstRate,
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
  // New select call sequence:
  //   1. resolveCustomer → accounts row
  //   2. resolveGstForLine → accounts.gstPosition (header GST)
  //   3. resolveGstForLine → lookupProduct (header GST, product gstCategory)
  //   4. validateProduct → lookupProduct (existence check)
  //   5. generateOrderNumber → salesOrders query
  // Then per line inside tx:
  //   6. resolveGstForLine → accounts.gstPosition
  //   7. resolveGstForLine → lookupProduct
  // =========================================================================

  describe('create', () => {
    const validDto = {
      customerId: 'CUST-001',
      lines: [{ productId: 'PROD-001', quantity: '10', pricePerUnit: '5.00' }],
    };

    function setupCreate(opts?: {
      gstPosition?: string;
      disc?: string;
      productGst?: string;
      currency?: string;
    }) {
      const gstPos = opts?.gstPosition ?? 'taxable';
      const disc = opts?.disc ?? '0';
      const prodGst = opts?.productGst ?? '9% GST';
      const currency = opts?.currency ?? 'EUR';

      // Map every select().from() call
      mockSelectChain({
        1: [{ id: 'CUST-001', customerDiscount: disc, currencyCode: currency }], // resolveCustomer
        2: [{ gstPosition: gstPos }], // resolveGstForLine → gstPosition
        3: [{ productId: 'PROD-001', gstCategory: prodGst }], // resolveGstForLine → lookupProduct
        4: [{ productId: 'PROD-001', gstCategory: prodGst }], // validateProduct → lookupProduct
        5: [], // generateOrderNumber
        6: [{ gstPosition: gstPos }], // line loop: resolveGstForLine → gstPosition
        7: [{ productId: 'PROD-001', gstCategory: prodGst }], // line loop: resolveGstForLine → lookupProduct
      });

      mockTransaction({
        salesOrderId: 'uuid-001',
        orderNumber: 'ORD-20260313-0001',
        stateCode: 'draft',
        customerDiscount: disc,
        currencyCode: currency,
        gstCategoryId: 'gst-default',
      });
    }

    it('should create an order in draft state', async () => {
      setupCreate();
      const result = await service.create(validDto, 'admin');
      expect(result).toHaveProperty('salesOrderId', 'uuid-001');
      expect(result).toHaveProperty('stateCode', 'draft');
    });

    it('should snapshot customer discount onto the order', async () => {
      setupCreate({ disc: '15' });
      const result = await service.create(validDto, 'admin');
      expect(result.customerDiscount).toBe('15');
    });

    it('should snapshot non-EUR currency onto the order (ADV-034)', async () => {
      setupCreate({ currency: 'SGD' });
      const result = await service.create(validDto, 'admin');
      expect(result.currencyCode).toBe('SGD');
    });

    it('should use product GST category for taxable customer', async () => {
      setupCreate({ gstPosition: 'taxable', productGst: '9% GST' });
      await service.create(validDto, 'admin');
      expect(mockGstService.getByCode).toHaveBeenCalledWith('GST');
    });

    it('should use zero-rated GST for zero-rated product', async () => {
      setupCreate({
        gstPosition: 'taxable',
        productGst: 'Zero Rated Products',
      });
      await service.create(validDto, 'admin');
      expect(mockGstService.getByCode).toHaveBeenCalledWith('ZR');
    });

    it('should use exempt GST for exempt customer (regardless of product)', async () => {
      // When customer is exempt, resolveGstForLine returns early (no product lookup),
      // so the select chain is shorter:
      // 1: resolveCustomer, 2: resolveGstForLine→gstPosition(exempt→return),
      // 3: resolveGstForLine→gstPosition(exempt→return) [header GST],
      // wait — header GST also skips product, so:
      // 1=resolveCustomer, 2=headerGst→gstPosition(exempt), 3=validateProduct→lookupProduct,
      // 4=generateOrderNumber, 5=lineGst→gstPosition(exempt)
      mockSelectChain({
        1: [{ id: 'CUST-001', customerDiscount: '0' }],
        2: [{ gstPosition: 'exempt' }], // header resolveGstForLine → exempt, returns early
        3: [{ productId: 'PROD-001', gstCategory: '9% GST' }], // validateProduct → lookupProduct
        4: [], // generateOrderNumber
        5: [{ gstPosition: 'exempt' }], // line resolveGstForLine → exempt, returns early
      });
      mockTransaction({
        salesOrderId: 'uuid-001',
        orderNumber: 'ORD-20260313-0001',
        stateCode: 'draft',
        customerDiscount: '0',
        gstCategoryId: 'gst-exempt',
      });

      await service.create(validDto, 'admin');
      expect(mockGstService.getByCode).toHaveBeenCalledWith('EXE');
    });

    it('should reject unknown customer', async () => {
      mockSelectChain({ 1: [] }); // resolveCustomer → not found
      await expect(service.create(validDto, 'admin')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject unknown product', async () => {
      mockSelectChain({
        1: [{ id: 'CUST-001', customerDiscount: '0' }],
        2: [{ gstPosition: 'taxable' }],
        3: [{ productId: 'PROD-001', gstCategory: '9% GST' }],
        4: [], // validateProduct → not found
      });
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
      // No productId → resolveGstForLine skips product lookup
      mockSelectChain({
        1: [{ id: 'CUST-001', customerDiscount: '0' }], // resolveCustomer
        2: [{ gstPosition: null }], // resolveGstForLine → gstPosition (no product, falls to default)
        3: [], // generateOrderNumber
      });
      mockTransaction({
        salesOrderId: 'uuid-no-lines',
        orderNumber: 'ORD-20260313-0001',
        stateCode: 'draft',
        customerDiscount: '0',
        gstCategoryId: 'gst-default',
      });

      const dto = { customerId: 'CUST-001', lines: [] };
      const result = await service.create(dto, 'admin');
      expect(result).toHaveProperty('salesOrderId');
    });

    it('should fall back to system default when product has unknown GST category', async () => {
      setupCreate({ productGst: 'Some Unknown Category' });
      await service.create(validDto, 'admin');
      expect(mockGstService.getDefault).toHaveBeenCalled();
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
              salesOrderId: 'uuid-001',
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
          salesOrderId: 'uuid-001',
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
        'uuid-001',
        { name: 'New Name' },
        'admin',
      );
      expect(result.name).toBe('New Name');
    });

    it('should update header fields on a quoted order', async () => {
      setupForUpdate('quoted');
      const result = await service.update(
        'uuid-001',
        { name: 'New Name' },
        'admin',
      );
      expect(result).toBeDefined();
    });

    it('should reject update on invoiced order', async () => {
      setupForUpdate('invoiced');
      await expect(
        service.update('uuid-001', { name: 'Test' }, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject update on cancelled order', async () => {
      setupForUpdate('cancelled');
      await expect(
        service.update('uuid-001', { notes: 'Test' }, 'admin'),
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
            order: { salesOrderId: 'uuid-001', stateCode: currentState },
            customerName: 'Test Customer',
          },
        ],
        2: [{ productId: 'PROD-001', quantity: '10' }], // order lines for inventory hooks
      });

      const txUpdateQb = createMockQueryBuilder([
        { salesOrderId: 'uuid-001', stateCode: '' },
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
        service.changeState('uuid-001', to, 'admin'),
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
        service.changeState('uuid-001', to, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject unknown state name', async () => {
      await expect(
        service.changeState('uuid-001', 'nonexistent_state', 'admin'),
      ).rejects.toThrow(BadRequestException);
    });

    // ── Inventory integration tests ──

    it('should call commitStock when confirming an order', async () => {
      mockSelectChain({
        1: [
          {
            order: { salesOrderId: 'uuid-001', stateCode: 'quoted' },
            customerName: 'Test Customer',
          },
        ],
        2: [{ productId: 'PROD-001', quantity: '10' }],
      });

      const txUpdateQb = createMockQueryBuilder([
        { salesOrderId: 'uuid-001', stateCode: 'confirmed' },
      ]);
      mockDb.transaction = jest.fn().mockImplementation(async (cb: any) => {
        const tx = createMockTx();
        tx.update = jest.fn().mockReturnValue(txUpdateQb);
        return cb(tx);
      });

      await service.changeState('uuid-001', 'confirmed', 'admin');
      expect(mockInventoryService.commitStock).toHaveBeenCalledTimes(1);
    });

    it('should call releaseStock when cancelling from confirmed state', async () => {
      mockSelectChain({
        1: [
          {
            order: { salesOrderId: 'uuid-001', stateCode: 'confirmed' },
            customerName: 'Test Customer',
          },
        ],
        2: [{ productId: 'PROD-001', quantity: '10' }],
      });

      const txUpdateQb = createMockQueryBuilder([
        { salesOrderId: 'uuid-001', stateCode: 'cancelled' },
      ]);
      mockDb.transaction = jest.fn().mockImplementation(async (cb: any) => {
        const tx = createMockTx();
        tx.update = jest.fn().mockReturnValue(txUpdateQb);
        return cb(tx);
      });

      await service.changeState('uuid-001', 'cancelled', 'admin');
      expect(mockInventoryService.releaseStock).toHaveBeenCalledTimes(1);
    });

    it('should NOT call commitStock when transitioning draft → quoted', async () => {
      setupWithState('draft');
      await service.changeState('uuid-001', 'quoted', 'admin');
      expect(mockInventoryService.commitStock).not.toHaveBeenCalled();
    });

    it('should NOT call releaseStock when cancelling from draft', async () => {
      mockSelectChain({
        1: [
          {
            order: { salesOrderId: 'uuid-001', stateCode: 'draft' },
            customerName: 'Test Customer',
          },
        ],
        2: [],
      });

      const txUpdateQb = createMockQueryBuilder([
        { salesOrderId: 'uuid-001', stateCode: 'cancelled' },
      ]);
      mockDb.transaction = jest.fn().mockImplementation(async (cb: any) => {
        const tx = createMockTx();
        tx.update = jest.fn().mockReturnValue(txUpdateQb);
        return cb(tx);
      });

      await service.changeState('uuid-001', 'cancelled', 'admin');
      expect(mockInventoryService.releaseStock).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // addLine()
  //
  // New select call sequence:
  //   1. findOrder → order row (with customerId)
  //   2. validateProduct → lookupProduct
  //   3. max line number query
  //   4. resolveGstForLine → accounts.gstPosition
  //   5. resolveGstForLine → lookupProduct (for product gstCategory)
  // =========================================================================

  describe('addLine', () => {
    const lineDto = {
      productId: 'PROD-001',
      quantity: '5',
      pricePerUnit: '12.00',
    };

    function setupForAddLine(orderState: string, maxLineNumber = 0) {
      mockSelectChain({
        1: [
          {
            order: {
              salesOrderId: 'uuid-001',
              stateCode: orderState,
              orderNumber: 'ORD-123',
              customerId: 'CUST-001',
              customerDiscount: '10',
              gstCategoryId: 'gst-default',
            },
            customerName: 'Test Customer',
          },
        ],
        2: [{ productId: 'PROD-001', gstCategory: '9% GST' }], // validateProduct → lookupProduct
        3: [], // NEW: Check if product already exists in this order (empty = not present)
        4: [{ max: maxLineNumber }], // max line number
        5: [{ gstPosition: 'taxable' }], // resolveGstForLine → gstPosition
        6: [{ productId: 'PROD-001', gstCategory: '9% GST' }], // resolveGstForLine → lookupProduct
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
      const result = await service.addLine('uuid-001', lineDto, 'admin');
      expect(result).toHaveProperty('salesOrderLineId');
      expect(result.lineNumber).toBe(3);
    });

    it('should resolve GST via product category', async () => {
      setupForAddLine('draft');
      await service.addLine('uuid-001', lineDto, 'admin');
      // resolveGstForLine should call getByCode with the mapped product GST code
      expect(mockGstService.getByCode).toHaveBeenCalledWith('GST');
    });

    it('should use per-line GST override when provided', async () => {
      setupForAddLine('draft');
      await service.addLine(
        'uuid-001',
        { ...lineDto, gstCategoryId: 'gst-exempt' },
        'admin',
      );
      expect(mockGstService.getById).toHaveBeenCalledWith('gst-exempt');
    });

    it('should reject adding to an invoiced order', async () => {
      setupForAddLine('invoiced');
      await expect(
        service.addLine('uuid-001', lineDto, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject adding to a shipped order', async () => {
      setupForAddLine('shipped');
      await expect(
        service.addLine('uuid-001', lineDto, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject adding to a cancelled order', async () => {
      setupForAddLine('cancelled');
      await expect(
        service.addLine('uuid-001', lineDto, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should use zero-rate for zero-rated product', async () => {
      mockSelectChain({
        1: [
          {
            order: {
              salesOrderId: 'uuid-001',
              stateCode: 'draft',
              orderNumber: 'ORD-123',
              customerId: 'CUST-001',
              customerDiscount: '0',
              gstCategoryId: 'gst-default',
            },
            customerName: 'Test Customer',
          },
        ],
        2: [{ productId: 'PROD-ZR', gstCategory: 'Zero Rated Products' }], // validateProduct
        3: [], // Duplicate check
        4: [{ max: 0 }],
        5: [{ gstPosition: 'taxable' }],
        6: [{ productId: 'PROD-ZR', gstCategory: 'Zero Rated Products' }],
      });
      const txInsertQb = createMockQueryBuilder([
        { salesOrderLineId: 'line-1', lineNumber: 1 },
      ]);
      mockDb.transaction = jest.fn().mockImplementation(async (cb: any) => {
        const tx = createMockTx();
        tx.insert = jest.fn().mockReturnValue(txInsertQb);
        return cb(tx);
      });

      await service.addLine(
        'uuid-001',
        { ...lineDto, productId: 'PROD-ZR' },
        'admin',
      );
      expect(mockGstService.getByCode).toHaveBeenCalledWith('ZR');
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
              salesOrderId: 'uuid-001',
              stateCode: orderState,
              gstCategoryId: 'gst-default',
            },
            customerName: 'Test Customer',
          },
        ],
        2: [
          {
            salesOrderLineId: 'line-001',
            salesOrderId: 'uuid-001',
            quantity: '10',
            pricePerUnit: '5.00',
            discountPercentage: '0',
            gstCategoryId: 'gst-default',
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
        'uuid-001',
        'line-001',
        { quantity: '20' },
        'admin',
      );
      expect(result).toHaveProperty('salesOrderLineId', 'line-001');
    });

    it('should resolve GST category for recomputation', async () => {
      setupForUpdateLine('draft');
      await service.updateLine(
        'uuid-001',
        'line-001',
        { quantity: '20' },
        'admin',
      );
      expect(mockGstService.getById).toHaveBeenCalledWith('gst-default');
    });

    it('should reject update on invoiced order', async () => {
      setupForUpdateLine('invoiced');
      await expect(
        service.updateLine('uuid-001', 'line-001', { quantity: '20' }, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject update on shipped order', async () => {
      setupForUpdateLine('shipped');
      await expect(
        service.updateLine('uuid-001', 'line-001', { quantity: '20' }, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject update on cancelled order', async () => {
      setupForUpdateLine('cancelled');
      await expect(
        service.updateLine('uuid-001', 'line-001', { quantity: '20' }, 'admin'),
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
            order: { salesOrderId: 'uuid-001', stateCode: orderState },
            customerName: 'Test Customer',
          },
        ],
        2: [
          {
            salesOrderLineId: 'line-001',
            salesOrderId: 'uuid-001',
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
        service.removeLine('uuid-001', 'line-001', 'admin'),
      ).resolves.toBeUndefined();
    });

    it('should call transaction for removal', async () => {
      setupForRemoveLine('draft');
      await service.removeLine('uuid-001', 'line-001', 'admin');
      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    });

    it('should reject removal from invoiced order', async () => {
      setupForRemoveLine('invoiced');
      await expect(
        service.removeLine('uuid-001', 'line-001', 'admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject removal from shipped order', async () => {
      setupForRemoveLine('shipped');
      await expect(
        service.removeLine('uuid-001', 'line-001', 'admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject removal from cancelled order', async () => {
      setupForRemoveLine('cancelled');
      await expect(
        service.removeLine('uuid-001', 'line-001', 'admin'),
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
            order: { salesOrderId: 'uuid-001', stateCode: 'draft' },
            customerName: 'Test Customer',
          },
        ],
        2: [{ salesOrderLineId: 'line-001', lineNumber: 1 }],
        3: [{ eventId: 'evt-001', eventType: 'created' }],
      });

      const result = await service.findOne('uuid-001');
      expect(result).toHaveProperty('salesOrderId', 'uuid-001');
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
              salesOrderId: 'uuid-001',
              stateCode: 'draft',
              gstCategoryId: 'gst-default',
            },
            customerName: 'Test Customer',
          },
        ],
        2: [], // line not found
      });

      await expect(
        service.updateLine('uuid-001', 'line-NOPE', { quantity: '1' }, 'admin'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if line belongs to different order', async () => {
      mockSelectChain({
        1: [
          {
            order: {
              salesOrderId: 'uuid-001',
              stateCode: 'draft',
              gstCategoryId: 'gst-default',
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
        service.updateLine('uuid-001', 'line-001', { quantity: '20' }, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
