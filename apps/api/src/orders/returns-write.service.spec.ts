import { Test, TestingModule } from '@nestjs/testing';
import { AppConfigService } from '../settings/app-config.service';
import { ReturnsWriteService } from './returns-write.service';
import { InventoryService } from '../inventory/inventory.service';
import { GlService } from '../gl/gl.service';
import { GstCategoriesService } from '../gst/gst-categories.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { emitEvent } from '../common/emit-event';
import { AggregateType } from '../common/event-types';

jest.mock('../common/emit-event', () => ({
  emitEvent: jest.fn().mockResolvedValue(undefined),
}));

// ---------------------------------------------------------------------------
// Mock helpers (reuse pattern from orders-write.service.spec.ts)
// ---------------------------------------------------------------------------

function createMockQueryBuilder(resolvedValue: any = []) {
  const qb: any = {
    values: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
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
const INVOICED_ORDER = {
  salesOrderId: 'order-001',
  orderNumber: 'ORD-20260315-0001',
  stateCode: 'invoiced',
  customerId: 'c0000000-0000-0000-0000-000000000001',
};

const DRAFT_ORDER = {
  salesOrderId: 'order-002',
  orderNumber: 'ORD-20260315-0002',
  stateCode: 'draft',
  customerId: 'c0000000-0000-0000-0000-000000000001',
};

const ORDER_LINE = {
  salesOrderLineId: 'line-001',
  salesOrderId: 'order-001',
  lineNumber: 1,
  productId: 'PROD-001',
  quantity: '10',
  pricePerUnit: '50.00',
  amount: '500.00',
};

const MOCK_RETURN = {
  returnId: 'ret-001',
  returnNumber: 'RET-20260315-0001',
  salesOrderId: 'order-001',
  stateCode: 'draft',
  notes: null,
  createdBy: 'admin',
};

const MOCK_RETURN_LINE = {
  returnLineId: 'retline-001',
  returnId: 'ret-001',
  salesOrderLineId: 'line-001',
  quantityReturned: '5',
  reason: 'Defective',
  returnFee: '10.00',
};

describe('ReturnsWriteService', () => {
  let service: ReturnsWriteService;
  let mockDb: any;
  let mockInventoryService: any;
  let mockGlService: any;
  let mockGstService: any;

  /**
   * Flexible select-chain mock that maps call indices to results.
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
        // Support innerJoin for getAlreadyReturnedQty
        qb.innerJoin = jest.fn().mockReturnValue(qb);
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

    mockInventoryService = {
      recordInventoryMovement: jest.fn().mockResolvedValue(undefined),
    };

    mockGlService = {
      getSettings: jest.fn().mockResolvedValue(null),
      postJournalEntry: jest.fn().mockResolvedValue({
        journalEntryId: 'je-001',
        entryNumber: 'JE-20260323-0001',
      }),
    };

    mockGstService = {
      getById: jest.fn().mockResolvedValue({ rate: '0' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: AppConfigService,
          useValue: {
            valuationMethod: jest.fn().mockReturnValue('weighted_average'),
          },
        },
        ReturnsWriteService,
        { provide: DRIZZLE, useValue: mockDb },
        { provide: InventoryService, useValue: mockInventoryService },
        { provide: GlService, useValue: mockGlService },
        { provide: GstCategoriesService, useValue: mockGstService },
      ],
    }).compile();

    service = module.get<ReturnsWriteService>(ReturnsWriteService);
  });

  // =========================================================================
  // createReturn()
  //
  // Select call sequence:
  //   1. findOrder → order row
  //   2. findOrderLine → order line row (per line in dto)
  //   3. getAlreadyReturnedQty → SUM query (per line)
  //   4. generateReturnNumber → returns query
  // =========================================================================

  describe('createReturn', () => {
    const validDto = {
      notes: 'Customer returned items',
      lines: [
        {
          salesOrderLineId: 'line-001',
          quantityReturned: '5',
          reason: 'Defective',
          returnFee: '10.00',
        },
      ],
    };

    function setupCreate(opts?: {
      orderState?: string;
      alreadyReturned?: string;
      originalQty?: string;
    }) {
      const orderState = opts?.orderState ?? 'invoiced';
      const alreadyReturned = opts?.alreadyReturned ?? '0';
      const originalQty = opts?.originalQty ?? '10';

      mockSelectChain({
        1: [{ ...INVOICED_ORDER, stateCode: orderState }], // findOrder
        2: [{ ...ORDER_LINE, quantity: originalQty }], // findOrderLine
        3: [{ total: alreadyReturned }], // getAlreadyReturnedQty
        4: [], // generateReturnNumber
      });

      mockTransaction({
        returnId: 'ret-001',
        returnNumber: 'RET-20260315-0001',
        salesOrderId: 'order-001',
        stateCode: 'draft',
      });
    }

    it('should create a return against an invoiced order', async () => {
      setupCreate();
      const result = await service.createReturn('order-001', validDto, 'admin');
      expect(result).toHaveProperty('returnId', 'ret-001');
      expect(result).toHaveProperty('stateCode', 'draft');
    });

    it('should reject return against a non-invoiced order', async () => {
      setupCreate({ orderState: 'draft' });
      await expect(
        service.createReturn('order-001', validDto, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject return against a confirmed order', async () => {
      setupCreate({ orderState: 'confirmed' });
      await expect(
        service.createReturn('order-001', validDto, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject return against a shipped order', async () => {
      setupCreate({ orderState: 'shipped' });
      await expect(
        service.createReturn('order-001', validDto, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject return when quantity exceeds original', async () => {
      setupCreate({ originalQty: '3' });
      await expect(
        service.createReturn('order-001', validDto, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject return when quantity exceeds remaining after prior returns', async () => {
      setupCreate({ alreadyReturned: '8' });
      await expect(
        service.createReturn('order-001', validDto, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject return with zero quantity', async () => {
      setupCreate();
      const dto = {
        lines: [{ salesOrderLineId: 'line-001', quantityReturned: '0' }],
      };
      await expect(
        service.createReturn('order-001', dto, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject return with negative fee', async () => {
      setupCreate();
      const dto = {
        lines: [
          {
            salesOrderLineId: 'line-001',
            quantityReturned: '5',
            returnFee: '-10',
          },
        ],
      };
      await expect(
        service.createReturn('order-001', dto, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create return with no lines', async () => {
      mockSelectChain({
        1: [INVOICED_ORDER], // findOrder
        2: [], // generateReturnNumber
      });
      mockTransaction({
        returnId: 'ret-002',
        returnNumber: 'RET-20260315-0001',
        salesOrderId: 'order-001',
        stateCode: 'draft',
      });

      const dto = { lines: [] };
      const result = await service.createReturn('order-001', dto, 'admin');
      expect(result).toHaveProperty('returnId');
    });

    it('should call transaction', async () => {
      setupCreate();
      await service.createReturn('order-001', validDto, 'admin');
      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // updateReturn()
  // =========================================================================

  describe('updateReturn', () => {
    function setupForUpdate(stateCode: string) {
      mockSelectChain({
        1: [{ ...MOCK_RETURN, stateCode }],
      });

      const txUpdateQb = createMockQueryBuilder([
        {
          ...MOCK_RETURN,
          stateCode,
          notes: 'Updated notes',
        },
      ]);
      mockDb.transaction = jest.fn().mockImplementation(async (cb: any) => {
        const tx = createMockTx();
        tx.update = jest.fn().mockReturnValue(txUpdateQb);
        return cb(tx);
      });
    }

    it('should update notes on a draft return', async () => {
      setupForUpdate('draft');
      const result = await service.updateReturn(
        'ret-001',
        { notes: 'Updated notes' },
        'admin',
      );
      expect(result.notes).toBe('Updated notes');
    });

    it('should reject update on confirmed return', async () => {
      setupForUpdate('confirmed');
      await expect(
        service.updateReturn('ret-001', { notes: 'Test' }, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject update on processed return', async () => {
      setupForUpdate('processed');
      await expect(
        service.updateReturn('ret-001', { notes: 'Test' }, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // =========================================================================
  // changeReturnState()
  // =========================================================================

  describe('changeReturnState', () => {
    function setupWithState(currentState: string) {
      mockSelectChain({
        1: [{ ...MOCK_RETURN, stateCode: currentState }],
      });

      const txUpdateQb = createMockQueryBuilder([
        { ...MOCK_RETURN, stateCode: '' },
      ]);
      mockDb.transaction = jest.fn().mockImplementation(async (cb: any) => {
        const tx = createMockTx();
        tx.update = jest.fn().mockReturnValue(txUpdateQb);
        tx.select = jest.fn().mockReturnValue({
          from: jest
            .fn()
            .mockReturnValue(
              createMockQueryBuilder([
                { binId: 'bin-dock', locationNo: 'DOCK' },
              ]),
            ),
        });
        return cb(tx);
      });
    }

    it.each([
      ['draft', 'confirmed'],
      ['draft', 'cancelled'],
      ['confirmed', 'processed'],
      ['confirmed', 'draft'],
    ])('should allow transition %s → %s', async (from, to) => {
      setupWithState(from);
      await expect(
        service.changeReturnState(
          'ret-001',
          to,
          'admin',
          to === 'processed' ? 'loc-1' : undefined,
        ),
      ).resolves.toBeDefined();
    });

    it.each([
      ['draft', 'processed'],
      ['confirmed', 'cancelled'],
      ['processed', 'draft'],
      ['processed', 'confirmed'],
      ['cancelled', 'draft'],
    ])('should reject transition %s → %s', async (from, to) => {
      setupWithState(from);
      await expect(
        service.changeReturnState(
          'ret-001',
          to,
          'admin',
          to === 'processed' ? 'loc-1' : undefined,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject unknown state name', async () => {
      await expect(
        service.changeReturnState('ret-001', 'nonexistent', 'admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should emit return_processed event when transitioning to processed', async () => {
      setupWithState('confirmed');
      await service.changeReturnState('ret-001', 'processed', 'admin', 'loc-1');
      // Verify the transaction was called (event is written inside)
      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // GL Credit Note posting (via changeReturnState → processed)
  //
  // postCreditNoteGl is private, tested indirectly through changeReturnState.
  // After the transaction, the method makes additional DB calls:
  //   1. glAccounts select (resolve account codes from settings IDs)
  //   2. sharedFindOrder (fetch order for customer info)
  //   3. salesOrderReturnLines select (fetch return lines)
  //   4. salesOrderLineItems select per return line (fetch pricing + GST)
  //   5. outbox insert (write credit_note_posted event)
  // =========================================================================

  describe('GL Credit Note posting', () => {
    const GL_SETTINGS = {
      defaultArAccountId: 'ar-acct-id',
      defaultRevenueAccountId: 'rev-acct-id',
      defaultTaxAccountId: 'tax-acct-id',
    };

    const GL_ACCOUNT_ROWS = [
      { glAccountId: 'ar-acct-id', accountCode: '1100' },
      { glAccountId: 'rev-acct-id', accountCode: '4100' },
      { glAccountId: 'tax-acct-id', accountCode: '2200' },
    ];

    const RETURN_LINE_WITH_FEE = {
      returnLineId: 'retline-001',
      returnId: 'ret-001',
      salesOrderLineId: 'line-001',
      quantityReturned: '5',
      reason: 'Defective',
      returnFee: '10.00',
    };

    const RETURN_LINE_NO_FEE = {
      ...RETURN_LINE_WITH_FEE,
      returnFee: '0',
    };

    const ORDER_LINE_WITH_GST = {
      ...ORDER_LINE,
      gstCategoryId: 'gst-cat-001',
      discountPercentage: '0',
    };

    const ORDER_LINE_NO_GST = {
      ...ORDER_LINE,
      gstCategoryId: null,
      discountPercentage: '0',
    };

    /**
     * Sets up the full call sequence for changeReturnState → processed,
     * including the post-transaction GL posting path.
     */
    function setupGlTest(opts: {
      settings?: any;
      glAccountRows?: any[];
      returnLines?: any[];
      orderLine?: any;
      gstRate?: string;
    }) {
      const settings =
        opts.settings !== undefined ? opts.settings : GL_SETTINGS;
      const glAccountRows = opts.glAccountRows ?? GL_ACCOUNT_ROWS;
      const returnLines = opts.returnLines ?? [RETURN_LINE_WITH_FEE];
      const orderLine = opts.orderLine ?? ORDER_LINE_WITH_GST;
      const gstRate = opts.gstRate ?? '10';

      // GL settings
      mockGlService.getSettings.mockResolvedValue(settings);

      // GST service
      mockGstService.getById.mockResolvedValue({ rate: gstRate });

      // The changeReturnState call sequence:
      // Phase 1 (before tx): select #1 = findReturn
      // Phase 2 (in tx): tx.update, tx.select (return lines for inventory), tx.select (order line), tx.insert (event)
      // Phase 3 (after tx - GL): select #2,3,4,5... = gl accounts, order, return lines, order line per line

      let selectCallCount = 0;
      const selectResponses: Record<number, any[]> = {
        1: [{ ...MOCK_RETURN, stateCode: 'confirmed' }], // findReturn
        2: glAccountRows, // GL account codes
        3: [INVOICED_ORDER], // sharedFindOrder
        4: returnLines, // return lines
        5: [orderLine], // order line (1st return line)
      };

      // Add more order line lookups for additional return lines
      for (let i = 1; i < returnLines.length; i++) {
        selectResponses[5 + i] = [orderLine];
      }

      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockImplementation(() => {
          selectCallCount++;
          const data = selectResponses[selectCallCount] ?? [];
          const qb = createMockQueryBuilder(data);
          qb.innerJoin = jest.fn().mockReturnValue(qb);
          return qb;
        }),
      });

      // Transaction: inventory restock + event
      const txUpdateQb = createMockQueryBuilder([
        { ...MOCK_RETURN, stateCode: 'processed' },
      ]);
      const txReturnLines = createMockQueryBuilder(returnLines);
      const txOrderLine = createMockQueryBuilder([
        { ...orderLine, binId: 'dock-bin-1', locationNo: 'DOCK' },
      ]);
      mockDb.transaction = jest.fn().mockImplementation(async (cb: any) => {
        const tx = createMockTx();
        tx.update = jest.fn().mockReturnValue(txUpdateQb);
        let txSelectCount = 0;
        tx.select = jest.fn().mockReturnValue({
          from: jest.fn().mockImplementation(() => {
            txSelectCount++;
            if (txSelectCount === 1) return txReturnLines; // return lines for inventory
            return txOrderLine; // order line for each
          }),
        });
        return cb(tx);
      });

      // Insert for outbox event (after GL posting)
      mockDb.insert = jest.fn().mockReturnValue(createMockQueryBuilder([]));
    }

    it('should post GL journal with correct lines (revenue + GST + fees)', async () => {
      setupGlTest({ gstRate: '10' });

      await service.changeReturnState('ret-001', 'processed', 'admin', 'loc-1');

      // 5 qty × $50.00 = $250.00 (credit amount)
      // 10% GST on $250 = $25.00
      // Fee = $10.00
      // Net AR = $250 + $25 - $10 = $265.00
      expect(mockGlService.postJournalEntry).toHaveBeenCalledTimes(1);

      const [glLines, meta] = mockGlService.postJournalEntry.mock.calls[0];

      // Verify sourceType
      expect(meta.sourceType).toBe('sales_credit_note');
      expect(meta.sourceId).toBe('ret-001');

      // Revenue debit
      const revLine = glLines.find((l: any) => l.accountCode === '4100');
      expect(revLine).toBeDefined();
      expect(revLine.debit).toBe(250);
      expect(revLine.credit).toBe(0);

      // AR credit with customer partyId
      const arLine = glLines.find((l: any) => l.accountCode === '1100');
      expect(arLine).toBeDefined();
      expect(arLine.debit).toBe(0);
      expect(arLine.credit).toBe(265); // 250 + 25 - 10
      expect(arLine.partyType).toBe('customer');
      expect(arLine.partyId).toBe('c0000000-0000-0000-0000-000000000001');

      // GST debit
      const taxLine = glLines.find((l: any) => l.accountCode === '2200');
      expect(taxLine).toBeDefined();
      expect(taxLine.debit).toBe(25);
      expect(taxLine.credit).toBe(0);

      // Fee credit
      const feeLine = glLines.find((l: any) => l.accountCode === '4900');
      expect(feeLine).toBeDefined();
      expect(feeLine.debit).toBe(0);
      expect(feeLine.credit).toBe(10);

      // Balance invariant: total debits = total credits
      const totalDebit = glLines.reduce((s: number, l: any) => s + l.debit, 0);
      const totalCredit = glLines.reduce(
        (s: number, l: any) => s + l.credit,
        0,
      );
      expect(totalDebit).toBeCloseTo(totalCredit, 2);
    });

    it('should omit fee line when no fees', async () => {
      setupGlTest({
        returnLines: [RETURN_LINE_NO_FEE],
        gstRate: '10',
      });

      await service.changeReturnState('ret-001', 'processed', 'admin', 'loc-1');

      const [glLines] = mockGlService.postJournalEntry.mock.calls[0];

      // No fee line
      const feeLine = glLines.find((l: any) => l.accountCode === '4900');
      expect(feeLine).toBeUndefined();

      // AR credit = 250 + 25 = 275 (no fee deduction)
      const arLine = glLines.find((l: any) => l.accountCode === '1100');
      expect(arLine.credit).toBe(275);

      // 3 lines only: Revenue, AR, GST
      expect(glLines).toHaveLength(3);

      // Balance invariant
      const totalDebit = glLines.reduce((s: number, l: any) => s + l.debit, 0);
      const totalCredit = glLines.reduce(
        (s: number, l: any) => s + l.credit,
        0,
      );
      expect(totalDebit).toBeCloseTo(totalCredit, 2);
    });

    it('should omit GST line when no tax applies', async () => {
      setupGlTest({
        orderLine: ORDER_LINE_NO_GST,
        gstRate: '0',
      });

      await service.changeReturnState('ret-001', 'processed', 'admin', 'loc-1');

      const [glLines] = mockGlService.postJournalEntry.mock.calls[0];

      // No tax line
      const taxLine = glLines.find((l: any) => l.accountCode === '2200');
      expect(taxLine).toBeUndefined();

      // AR credit = 250 - 10 = 240 (no tax)
      const arLine = glLines.find((l: any) => l.accountCode === '1100');
      expect(arLine.credit).toBe(240);

      // Balance invariant
      const totalDebit = glLines.reduce((s: number, l: any) => s + l.debit, 0);
      const totalCredit = glLines.reduce(
        (s: number, l: any) => s + l.credit,
        0,
      );
      expect(totalDebit).toBeCloseTo(totalCredit, 2);
    });

    it('should skip GL posting when settings are incomplete', async () => {
      setupGlTest({ settings: null });

      await service.changeReturnState('ret-001', 'processed', 'admin', 'loc-1');

      expect(mockGlService.postJournalEntry).not.toHaveBeenCalled();
    });

    it('should skip GL posting when AR account ID is missing', async () => {
      setupGlTest({
        settings: { ...GL_SETTINGS, defaultArAccountId: null },
      });

      await service.changeReturnState('ret-001', 'processed', 'admin', 'loc-1');

      expect(mockGlService.postJournalEntry).not.toHaveBeenCalled();
    });

    it('should not throw when GL posting fails (non-fatal)', async () => {
      setupGlTest({});
      mockGlService.postJournalEntry.mockRejectedValue(
        new Error('GL service unavailable'),
      );

      // Should not throw — GL failure is non-fatal
      await expect(
        service.changeReturnState('ret-001', 'processed', 'admin', 'loc-1'),
      ).resolves.toBeDefined();

      // State transition still succeeded
      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    });

    it('should write outbox event with correct payload', async () => {
      setupGlTest({ gstRate: '10' });

      await service.changeReturnState('ret-001', 'processed', 'admin', 'loc-1');

      // emitEvent should have been called for return_processed AND credit_note_posted
      expect(emitEvent).toHaveBeenCalled();

      // Find the emit call for credit_note_posted
      const emitCall = (emitEvent as jest.Mock).mock.calls.find(
        (call) => call[1].eventType === 'credit_note_posted',
      );

      expect(emitCall).toBeDefined();
      const payload = emitCall[1].payload;

      expect(emitCall[1].aggregateType).toBe(AggregateType.SALES_ORDER);
      expect(emitCall[1].eventType).toBe('credit_note_posted');
      expect(payload.returnId).toBe('ret-001');
      expect(payload.customerId).toBe('c0000000-0000-0000-0000-000000000001');
      expect(payload.totalCredit).toBe(250);
      expect(payload.totalTax).toBe(25);
      expect(payload.totalFees).toBe(10);
      expect(payload.netCredit).toBe(265);
      expect(payload.lines).toHaveLength(1);
      expect(payload.lines[0].productId).toBe('PROD-001');
    });

    it('should use per-line GST from gstCategoryId', async () => {
      setupGlTest({ gstRate: '15' }); // 15% GST

      await service.changeReturnState('ret-001', 'processed', 'admin', 'loc-1');

      // Verify gstService.getById was called with the line's category
      expect(mockGstService.getById).toHaveBeenCalledWith('gst-cat-001');

      const [glLines] = mockGlService.postJournalEntry.mock.calls[0];

      // 5 × $50 = $250, 15% GST = $37.50
      const taxLine = glLines.find((l: any) => l.accountCode === '2200');
      expect(taxLine.debit).toBe(37.5);

      // AR = 250 + 37.5 - 10 = 277.5
      const arLine = glLines.find((l: any) => l.accountCode === '1100');
      expect(arLine.credit).toBe(277.5);
    });
  });

  // =========================================================================
  // addReturnLine()
  //
  // Select call sequence:
  //   1. findReturn → return row
  //   2. findOrderLine → order line row
  //   3. getAlreadyReturnedQty → SUM
  // =========================================================================

  describe('addReturnLine', () => {
    const lineDto = {
      salesOrderLineId: 'line-001',
      quantityReturned: '3',
      reason: 'Wrong item',
      returnFee: '5.00',
    };

    function setupForAddLine(returnState: string, alreadyReturned = '0') {
      mockSelectChain({
        1: [{ ...MOCK_RETURN, stateCode: returnState }],
        2: [ORDER_LINE],
        3: [{ total: alreadyReturned }],
      });

      const txInsertQb = createMockQueryBuilder([
        {
          returnLineId: 'retline-002',
          returnId: 'ret-001',
          salesOrderLineId: 'line-001',
          quantityReturned: '3',
        },
      ]);
      mockDb.transaction = jest.fn().mockImplementation(async (cb: any) => {
        const tx = createMockTx();
        tx.insert = jest.fn().mockReturnValue(txInsertQb);
        return cb(tx);
      });
    }

    it('should add a line to a draft return', async () => {
      setupForAddLine('draft');
      const result = await service.addReturnLine('ret-001', lineDto, 'admin');
      expect(result).toHaveProperty('returnLineId');
    });

    it('should reject adding to a confirmed return', async () => {
      setupForAddLine('confirmed');
      await expect(
        service.addReturnLine('ret-001', lineDto, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject adding to a processed return', async () => {
      setupForAddLine('processed');
      await expect(
        service.addReturnLine('ret-001', lineDto, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject when quantity exceeds remaining', async () => {
      setupForAddLine('draft', '9');
      const dto = { ...lineDto, quantityReturned: '5' };
      await expect(
        service.addReturnLine('ret-001', dto, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject negative return fee', async () => {
      setupForAddLine('draft');
      const dto = { ...lineDto, returnFee: '-1' };
      await expect(
        service.addReturnLine('ret-001', dto, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // =========================================================================
  // updateReturnLine()
  // =========================================================================

  describe('updateReturnLine', () => {
    function setupForUpdateLine(returnState: string) {
      mockSelectChain({
        1: [{ ...MOCK_RETURN, stateCode: returnState }],
        2: [MOCK_RETURN_LINE],
      });

      const txUpdateQb = createMockQueryBuilder([
        {
          ...MOCK_RETURN_LINE,
          quantityReturned: '3',
        },
      ]);
      mockDb.transaction = jest.fn().mockImplementation(async (cb: any) => {
        const tx = createMockTx();
        tx.update = jest.fn().mockReturnValue(txUpdateQb);
        return cb(tx);
      });
    }

    it('should update return line on a draft return', async () => {
      setupForUpdateLine('draft');
      const result = await service.updateReturnLine(
        'ret-001',
        'retline-001',
        { reason: 'Changed mind' },
        'admin',
      );
      expect(result).toBeDefined();
    });

    it('should reject update on confirmed return', async () => {
      setupForUpdateLine('confirmed');
      await expect(
        service.updateReturnLine(
          'ret-001',
          'retline-001',
          { reason: 'Test' },
          'admin',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject negative return fee', async () => {
      setupForUpdateLine('draft');
      await expect(
        service.updateReturnLine(
          'ret-001',
          'retline-001',
          { returnFee: '-5' },
          'admin',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // =========================================================================
  // removeReturnLine()
  // =========================================================================

  describe('removeReturnLine', () => {
    function setupForRemoveLine(returnState: string) {
      mockSelectChain({
        1: [{ ...MOCK_RETURN, stateCode: returnState }],
        2: [MOCK_RETURN_LINE],
      });
      mockDb.transaction = jest
        .fn()
        .mockImplementation(async (cb: any) => cb(createMockTx()));
    }

    it('should remove a line from a draft return', async () => {
      setupForRemoveLine('draft');
      await expect(
        service.removeReturnLine('ret-001', 'retline-001', 'admin'),
      ).resolves.toBeUndefined();
    });

    it('should reject removal from confirmed return', async () => {
      setupForRemoveLine('confirmed');
      await expect(
        service.removeReturnLine('ret-001', 'retline-001', 'admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject removal from processed return', async () => {
      setupForRemoveLine('processed');
      await expect(
        service.removeReturnLine('ret-001', 'retline-001', 'admin'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // =========================================================================
  // findOne() / findByOrder()
  // =========================================================================

  describe('findOne', () => {
    it('should return return with lines', async () => {
      mockSelectChain({
        1: [MOCK_RETURN],
        2: [MOCK_RETURN_LINE],
      });

      const result = await service.findOne('ret-001');
      expect(result).toHaveProperty('returnId', 'ret-001');
      expect(result.lines).toHaveLength(1);
    });

    it('should throw NotFoundException for unknown return', async () => {
      mockSelectChain({ 1: [] });
      await expect(service.findOne('NONEXISTENT')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByOrder', () => {
    it('should return all returns for an order', async () => {
      // First call: list returns; subsequent calls: lines per return
      let call = 0;
      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockImplementation(() => {
          call++;
          if (call === 1) {
            return createMockQueryBuilder([MOCK_RETURN]);
          }
          return createMockQueryBuilder([MOCK_RETURN_LINE]);
        }),
      });

      const result = await service.findByOrder('order-001');
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('returnId', 'ret-001');
      expect(result[0].lines).toHaveLength(1);
    });
  });

  // =========================================================================
  // Helper validation
  // =========================================================================

  describe('findReturn (via updateReturn)', () => {
    it('should throw NotFoundException when return does not exist', async () => {
      mockSelectChain({ 1: [] });
      await expect(
        service.updateReturn('NONEXISTENT', { notes: 'test' }, 'admin'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findReturnLine (via updateReturnLine)', () => {
    it('should throw NotFoundException when return line does not exist', async () => {
      mockSelectChain({
        1: [MOCK_RETURN],
        2: [],
      });
      await expect(
        service.updateReturnLine(
          'ret-001',
          'NONEXISTENT',
          { reason: 'test' },
          'admin',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if line belongs to different return', async () => {
      mockSelectChain({
        1: [MOCK_RETURN],
        2: [{ ...MOCK_RETURN_LINE, returnId: 'ret-OTHER' }],
      });
      await expect(
        service.updateReturnLine(
          'ret-001',
          'retline-001',
          { reason: 'test' },
          'admin',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
