import { Test, TestingModule } from '@nestjs/testing';
import { SalesInvoiceService } from './sales-invoice.service';
import { GlService } from '../gl/gl.service';
import { GstCategoriesService } from '../gst/gst-categories.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { NotFoundException, BadRequestException } from '@nestjs/common';

// ---------------------------------------------------------------------------
// Mock helpers (same pattern as shipment.service.spec.ts)
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

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const SHIPPED_ORDER = {
  salesOrderId: 'order-001',
  orderNumber: 'ORD-20260323-0001',
  stateCode: 'shipped',
  customerId: 'cust-001',
  currencyCode: 'AUD',
};

const PICKING_ORDER = {
  ...SHIPPED_ORDER,
  stateCode: 'picking',
};

const ORDER_LINE_A = {
  salesOrderLineId: 'line-001',
  salesOrderId: 'order-001',
  lineNumber: 1,
  productId: 'prod-001',
  productDescription: 'Widget A',
  quantity: '10',
  pricePerUnit: '25.00',
  tax: '10',
  amount: '250.00',
};

const ORDER_LINE_B = {
  salesOrderLineId: 'line-002',
  salesOrderId: 'order-001',
  lineNumber: 2,
  productId: 'prod-002',
  productDescription: 'Widget B',
  quantity: '5',
  pricePerUnit: '100.00',
  tax: '0',
  amount: '500.00',
};

const CUSTOMER = {
  erpnextId: 'CUST-ERP-001',
  name: 'Acme Corp',
};

const MOCK_INVOICE = {
  invoiceId: 'inv-001',
  invoiceNumber: 'INV-20260323-0001',
  salesOrderId: 'order-001',
  totalAmount: '775.00',
  taxAmount: '25.00',
  currencyCode: 'AUD',
  stateCode: 'invoiced',
  createdOn: new Date(),
};

const MOCK_INVOICE_LINE = {
  invoiceLineId: 'invline-001',
  invoiceId: 'inv-001',
  salesOrderLineId: 'line-001',
  quantityInvoiced: '10',
  pricePerUnit: '25.00',
  amount: '250.00',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SalesInvoiceService', () => {
  let service: SalesInvoiceService;
  let mockDb: any;
  let mockGlService: any;

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

    mockGlService = {
      getSettings: jest.fn().mockResolvedValue(null),
      postJournalEntry: jest
        .fn()
        .mockResolvedValue({ journalEntryId: 'je-001' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalesInvoiceService,
        { provide: DRIZZLE, useValue: mockDb },
        { provide: GlService, useValue: mockGlService },
        {
          provide: GstCategoriesService,
          useValue: {
            getById: jest.fn().mockResolvedValue({ rate: '0' }),
            getByCode: jest.fn().mockResolvedValue({ rate: '0' }),
          },
        },
      ],
    }).compile();

    service = module.get<SalesInvoiceService>(SalesInvoiceService);
  });

  // =========================================================================
  // createInvoice — state validation
  // =========================================================================

  describe('createInvoice — state validation', () => {
    it('should reject if order is not found', async () => {
      mockSelectChain({ 1: [] });
      await expect(
        service.createInvoice('nonexistent', {}, 'admin'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject if order is in draft state', async () => {
      mockSelectChain({ 1: [{ ...SHIPPED_ORDER, stateCode: 'draft' }] });
      await expect(
        service.createInvoice('order-001', {}, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject if order is in confirmed state', async () => {
      mockSelectChain({ 1: [{ ...SHIPPED_ORDER, stateCode: 'confirmed' }] });
      await expect(
        service.createInvoice('order-001', {}, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject if order is already invoiced', async () => {
      mockSelectChain({ 1: [{ ...SHIPPED_ORDER, stateCode: 'invoiced' }] });
      await expect(
        service.createInvoice('order-001', {}, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should accept orders in shipped state', async () => {
      // Setup: order found, customer found, one line, no prior invoices,
      // shipped qty covers it, invoice number gen
      mockSelectChain({
        1: [SHIPPED_ORDER], // findOrder
        2: [CUSTOMER], // customer lookup
        3: [ORDER_LINE_A], // orderLines
        4: [], // generateInvoiceNumber
        5: [], // prior invoice lines
        6: [], // getCommittedPerLine — shipments
      });

      // The getCommittedPerLine needs to return shipped qty via shipments query
      // Override with a more specific setup:
      let selectCall = 0;
      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockImplementation(() => {
          selectCall++;
          const responses: Record<number, any[]> = {
            1: [SHIPPED_ORDER],
            2: [CUSTOMER],
            3: [ORDER_LINE_A],
            4: [], // generateInvoiceNumber
            5: [], // prior invoice lines
            6: [
              {
                // getCommittedPerLine — shipments (non-cancelled)
                shipmentId: 'ship-001',
                salesOrderId: 'order-001',
                stateCode: 'dispatched',
              },
            ],
            7: [
              {
                // shipment lines for that shipment
                salesOrderLineId: 'line-001',
                quantityShipped: '10',
              },
            ],
          };
          const data = responses[selectCall] ?? [];
          const qb = createMockQueryBuilder(data);
          qb.innerJoin = jest.fn().mockReturnValue(qb);
          qb.leftJoin = jest.fn().mockReturnValue(qb);
          return qb;
        }),
      });

      const txInsertQb = createMockQueryBuilder([MOCK_INVOICE]);
      mockDb.transaction = jest.fn().mockImplementation(async (cb: any) => {
        const tx = createMockTx();
        tx.insert = jest.fn().mockReturnValue(txInsertQb);
        tx.update = jest.fn().mockReturnValue(createMockQueryBuilder([]));
        return cb(tx);
      });

      const result = await service.createInvoice('order-001', {}, 'admin');
      expect(result).toHaveProperty('invoiceId', 'inv-001');
      expect(mockDb.transaction).toHaveBeenCalled();
    });

    it('should accept orders in picking state', async () => {
      let selectCall = 0;
      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockImplementation(() => {
          selectCall++;
          const responses: Record<number, any[]> = {
            1: [PICKING_ORDER],
            2: [CUSTOMER],
            3: [ORDER_LINE_A],
            4: [],
            5: [],
            6: [
              {
                shipmentId: 'ship-001',
                salesOrderId: 'order-001',
                stateCode: 'dispatched',
              },
            ],
            7: [{ salesOrderLineId: 'line-001', quantityShipped: '10' }],
          };
          const data = responses[selectCall] ?? [];
          const qb = createMockQueryBuilder(data);
          qb.innerJoin = jest.fn().mockReturnValue(qb);
          qb.leftJoin = jest.fn().mockReturnValue(qb);
          return qb;
        }),
      });

      const txInsertQb = createMockQueryBuilder([MOCK_INVOICE]);
      mockDb.transaction = jest.fn().mockImplementation(async (cb: any) => {
        const tx = createMockTx();
        tx.insert = jest.fn().mockReturnValue(txInsertQb);
        tx.update = jest.fn().mockReturnValue(createMockQueryBuilder([]));
        return cb(tx);
      });

      const result = await service.createInvoice('order-001', {}, 'admin');
      expect(result).toHaveProperty('invoiceId', 'inv-001');
    });
  });

  // =========================================================================
  // createInvoice — quantity validation
  // =========================================================================

  describe('createInvoice — quantity validation', () => {
    it('should reject if order has no lines', async () => {
      mockSelectChain({
        1: [SHIPPED_ORDER],
        2: [CUSTOMER],
        3: [], // empty orderLines
      });
      await expect(
        service.createInvoice('order-001', {}, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject invoicing more than shipped quantity', async () => {
      let selectCall = 0;
      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockImplementation(() => {
          selectCall++;
          const responses: Record<number, any[]> = {
            1: [SHIPPED_ORDER],
            2: [CUSTOMER],
            3: [ORDER_LINE_A], // ordered 10
            4: [], // invoiceNumber
            5: [], // prior invoices
            6: [
              {
                shipmentId: 'ship-001',
                salesOrderId: 'order-001',
                stateCode: 'dispatched',
              },
            ],
            7: [{ salesOrderLineId: 'line-001', quantityShipped: '5' }], // only shipped 5
          };
          const data = responses[selectCall] ?? [];
          const qb = createMockQueryBuilder(data);
          qb.innerJoin = jest.fn().mockReturnValue(qb);
          qb.leftJoin = jest.fn().mockReturnValue(qb);
          return qb;
        }),
      });

      // Try to invoice 8 when only 5 shipped
      await expect(
        service.createInvoice(
          'order-001',
          { lines: [{ salesOrderLineId: 'line-001', quantityToInvoice: 8 }] },
          'admin',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject if nothing available to invoice (all zero qty)', async () => {
      let selectCall = 0;
      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockImplementation(() => {
          selectCall++;
          const responses: Record<number, any[]> = {
            1: [SHIPPED_ORDER],
            2: [CUSTOMER],
            3: [ORDER_LINE_A],
            4: [],
            5: [],
            6: [], // no shipments at all
          };
          const data = responses[selectCall] ?? [];
          const qb = createMockQueryBuilder(data);
          qb.innerJoin = jest.fn().mockReturnValue(qb);
          qb.leftJoin = jest.fn().mockReturnValue(qb);
          return qb;
        }),
      });

      // Default mode (no lines specified) — shipped is 0, so nothing to invoice
      await expect(
        service.createInvoice('order-001', {}, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // =========================================================================
  // createInvoice — GL posting
  // =========================================================================

  describe('createInvoice — GL posting', () => {
    it('should attempt GL posting when settings are configured', async () => {
      let selectCall = 0;
      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockImplementation(() => {
          selectCall++;
          const responses: Record<number, any[]> = {
            1: [SHIPPED_ORDER],
            2: [CUSTOMER],
            3: [ORDER_LINE_A],
            4: [],
            5: [],
            6: [
              {
                shipmentId: 'ship-001',
                salesOrderId: 'order-001',
                stateCode: 'dispatched',
              },
            ],
            7: [{ salesOrderLineId: 'line-001', quantityShipped: '10' }],
            // After transaction, GL settings lookup triggers more selects
            8: [
              { glAccountId: 'gl-ar', accountCode: '1100' },
              { glAccountId: 'gl-rev', accountCode: '4000' },
            ],
          };
          const data = responses[selectCall] ?? [];
          const qb = createMockQueryBuilder(data);
          qb.innerJoin = jest.fn().mockReturnValue(qb);
          qb.leftJoin = jest.fn().mockReturnValue(qb);
          return qb;
        }),
      });

      const txInsertQb = createMockQueryBuilder([MOCK_INVOICE]);
      mockDb.transaction = jest.fn().mockImplementation(async (cb: any) => {
        const tx = createMockTx();
        tx.insert = jest.fn().mockReturnValue(txInsertQb);
        tx.update = jest.fn().mockReturnValue(createMockQueryBuilder([]));
        return cb(tx);
      });

      mockGlService.getSettings.mockResolvedValue({
        defaultArAccountId: 'gl-ar',
        defaultRevenueAccountId: 'gl-rev',
        defaultTaxAccountId: null,
      });

      const result = await service.createInvoice('order-001', {}, 'admin');
      expect(result).toHaveProperty('invoiceId');
      expect(mockGlService.getSettings).toHaveBeenCalled();
      expect(mockGlService.postJournalEntry).toHaveBeenCalled();
    });

    it('should not throw if GL posting fails (non-fatal)', async () => {
      let selectCall = 0;
      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockImplementation(() => {
          selectCall++;
          const responses: Record<number, any[]> = {
            1: [SHIPPED_ORDER],
            2: [CUSTOMER],
            3: [ORDER_LINE_A],
            4: [],
            5: [],
            6: [
              {
                shipmentId: 'ship-001',
                salesOrderId: 'order-001',
                stateCode: 'dispatched',
              },
            ],
            7: [{ salesOrderLineId: 'line-001', quantityShipped: '10' }],
            8: [
              { glAccountId: 'gl-ar', accountCode: '1100' },
              { glAccountId: 'gl-rev', accountCode: '4000' },
            ],
          };
          const data = responses[selectCall] ?? [];
          const qb = createMockQueryBuilder(data);
          qb.innerJoin = jest.fn().mockReturnValue(qb);
          qb.leftJoin = jest.fn().mockReturnValue(qb);
          return qb;
        }),
      });

      const txInsertQb = createMockQueryBuilder([MOCK_INVOICE]);
      mockDb.transaction = jest.fn().mockImplementation(async (cb: any) => {
        const tx = createMockTx();
        tx.insert = jest.fn().mockReturnValue(txInsertQb);
        tx.update = jest.fn().mockReturnValue(createMockQueryBuilder([]));
        return cb(tx);
      });

      mockGlService.getSettings.mockResolvedValue({
        defaultArAccountId: 'gl-ar',
        defaultRevenueAccountId: 'gl-rev',
      });
      mockGlService.postJournalEntry.mockRejectedValue(new Error('GL down'));

      // Should NOT throw even though GL fails
      const result = await service.createInvoice('order-001', {}, 'admin');
      expect(result).toHaveProperty('invoiceId');
    });
  });

  // =========================================================================
  // findOne
  // =========================================================================

  describe('findOne', () => {
    it('should return invoice with hydrated lines', async () => {
      mockSelectChain({
        1: [MOCK_INVOICE],
        2: [{ ...MOCK_INVOICE_LINE, productId: 'prod-001' }],
      });
      const result = await service.findOne('inv-001');
      expect(result).toHaveProperty('invoiceId', 'inv-001');
      expect(result.lines).toHaveLength(1);
    });

    it('should throw NotFoundException for unknown invoice', async () => {
      mockSelectChain({ 1: [] });
      await expect(service.findOne('NONEXISTENT')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // =========================================================================
  // findByOrder
  // =========================================================================

  describe('findByOrder', () => {
    it('should return empty array when no invoices exist', async () => {
      mockSelectChain({ 1: [] });
      const result = await service.findByOrder('order-001');
      expect(result).toEqual([]);
    });

    it('should return invoices with hydrated lines', async () => {
      let selectCall = 0;
      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockImplementation(() => {
          selectCall++;
          if (selectCall === 1) {
            return createMockQueryBuilder([MOCK_INVOICE]);
          }
          // Lines query for the invoice
          const qb = createMockQueryBuilder([
            { ...MOCK_INVOICE_LINE, invoiceId: 'inv-001' },
          ]);
          return qb;
        }),
      });

      const result = await service.findByOrder('order-001');
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('invoiceId', 'inv-001');
      expect(result[0].lines).toHaveLength(1);
    });
  });

  // =========================================================================
  // findActiveInvoices
  // =========================================================================

  describe('findActiveInvoices', () => {
    it('should query with default parameters', async () => {
      let selectCall = 0;
      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockImplementation(() => {
          selectCall++;
          const qb = createMockQueryBuilder([]);
          qb.innerJoin = jest.fn().mockReturnValue(qb);
          qb.leftJoin = jest.fn().mockReturnValue(qb);
          return qb;
        }),
      });

      const result = await service.findActiveInvoices({});
      expect(result).toEqual([]);
      expect(mockDb.select).toHaveBeenCalled();
    });

    it('should return invoices when data exists', async () => {
      let selectCall = 0;
      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockImplementation(() => {
          selectCall++;
          const qb = createMockQueryBuilder([
            {
              invoiceId: 'inv-001',
              invoiceNumber: 'INV-20260323-0001',
              salesOrderId: 'order-001',
              orderNumber: 'ORD-20260323-0001',
              customerId: 'cust-001',
              customerName: 'Acme Corp',
              totalAmount: '775.00',
              taxAmount: '25.00',
              currencyCode: 'AUD',
              stateCode: 'invoiced',
              createdOn: new Date(),
            },
          ]);
          qb.innerJoin = jest.fn().mockReturnValue(qb);
          qb.leftJoin = jest.fn().mockReturnValue(qb);
          return qb;
        }),
      });

      const result = await service.findActiveInvoices({ days: 7 });
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('invoiceNumber', 'INV-20260323-0001');
    });
  });
});
