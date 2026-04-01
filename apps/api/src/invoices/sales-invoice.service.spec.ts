import { Test, TestingModule } from '@nestjs/testing';
import { SalesInvoiceService } from './sales-invoice.service';
import { GlService } from '../gl/gl.service';
import { GstCategoriesService } from '../gst/gst-categories.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { NotFoundException, BadRequestException } from '@nestjs/common';

let mockRevenuePrecedence = 'product_first';
jest.mock('@modbm/shared', () => ({
  __esModule: true,
  ...jest.requireActual('@modbm/shared'),
  get REVENUE_ROUTING_PRECEDENCE() {
    return mockRevenuePrecedence;
  },
}));

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
    let callCount = 0;
    mockDb.select = jest.fn().mockImplementation(() => {
      return {
        from: jest.fn().mockImplementation(() => {
          callCount++;
          const data = responses[callCount] ?? [];
          const qb = createMockQueryBuilder(data);
          qb.innerJoin = jest.fn().mockReturnValue(qb);
          qb.leftJoin = jest.fn().mockReturnValue(qb);
          return qb;
        }),
      };
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
      mockSelectChain({
        1: [SHIPPED_ORDER], // findOrder
        2: [CUSTOMER], // customer lookup
        3: [{ ...ORDER_LINE_A, productType: 'inventory' }], // orderLines
        4: [], // generateInvoiceNumber
        5: [], // prior invoice lines
        6: [{ shipmentId: 's', stateCode: 'dispatched' }], // getCommittedPerLine
        7: [{ salesOrderLineId: 'line-001', quantityShipped: '10' }], // getCommittedPerLine lines
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
      mockSelectChain({
        1: [SHIPPED_ORDER],
        2: [CUSTOMER],
        3: [{ ...ORDER_LINE_A, productType: 'inventory' }],
        4: [],
        5: [],
        6: [{ shipmentId: 'ship-001', stateCode: 'dispatched' }],
        7: [{ salesOrderLineId: 'line-001', quantityShipped: '5' }],
      });

      await expect(
        service.createInvoice(
          'order-001',
          { lines: [{ salesOrderLineId: 'line-001', quantityToInvoice: 8 }] },
          'admin',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject if nothing available to invoice (all zero qty)', async () => {
      mockSelectChain({
        1: [SHIPPED_ORDER],
        2: [CUSTOMER],
        3: [{ ...ORDER_LINE_A, productType: 'inventory' }],
        4: [],
        5: [],
        6: [], // no shipments
      });

      await expect(
        service.createInvoice('order-001', {}, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // =========================================================================
  // createInvoice — GL Routing Rules
  // =========================================================================

  describe('createInvoice — GL Routing Rules', () => {
    const GL_ACCTS = [
      { glAccountId: 'gl-ar', accountCode: '1100' },
      { glAccountId: 'gl-rev-sys', accountCode: '4000' },
      { glAccountId: 'gl-rev-prod-a', accountCode: '4101' },
      { glAccountId: 'gl-rev-prod-b', accountCode: '4102' },
      { glAccountId: 'gl-rev-cust', accountCode: '4200' },
    ];

    beforeEach(() => {
      mockGlService.getSettings.mockResolvedValue({
        defaultArAccountId: 'gl-ar',
        defaultRevenueAccountId: 'gl-rev-sys',
      });

      const txInsertQb = createMockQueryBuilder([MOCK_INVOICE]);
      mockDb.transaction = jest.fn().mockImplementation(async (cb: any) => {
        const tx = createMockTx();
        tx.insert = jest.fn().mockReturnValue(txInsertQb);
        tx.update = jest.fn().mockReturnValue(createMockQueryBuilder([]));
        return cb(tx);
      });
    });

    it('should fallback to system default when no other accounts are set', async () => {
      mockSelectChain({
        1: [SHIPPED_ORDER],
        2: [CUSTOMER],
        3: [
          {
            ...ORDER_LINE_A,
            productType: 'inventory',
            productRevenueAccountId: null,
          },
        ],
        4: [],
        5: [],
        6: [{ shipmentId: 's', stateCode: 'dispatched' }],
        7: [{ salesOrderLineId: 'line-001', quantityShipped: '10' }],
        8: GL_ACCTS,
      });

      await service.createInvoice('order-001', {}, 'admin');

      expect(mockGlService.postJournalEntry).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            accountCode: '4000', // System default
            credit: 250,
          }),
        ]),
        expect.objectContaining({ actor: 'admin' }),
      );
    });

    it('should obey product_first precedence', async () => {
      mockRevenuePrecedence = 'product_first';
      mockSelectChain({
        1: [SHIPPED_ORDER],
        2: [{ ...CUSTOMER, defaultRevenueAccountId: 'gl-rev-cust' }],
        3: [
          {
            ...ORDER_LINE_A,
            productType: 'inventory',
            productRevenueAccountId: 'gl-rev-prod-a',
          },
        ],
        4: [],
        5: [],
        6: [{ shipmentId: 's', stateCode: 'dispatched' }],
        7: [{ salesOrderLineId: 'line-001', quantityShipped: '10' }],
        8: GL_ACCTS,
      });

      await service.createInvoice('order-001', {}, 'admin');

      expect(mockGlService.postJournalEntry).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            accountCode: '4101', // Product preference
            credit: 250,
          }),
        ]),
        expect.anything(),
      );
    });

    it('should obey customer_first precedence', async () => {
      mockRevenuePrecedence = 'customer_first';
      mockSelectChain({
        1: [SHIPPED_ORDER],
        2: [{ ...CUSTOMER, defaultRevenueAccountId: 'gl-rev-cust' }],
        3: [
          {
            ...ORDER_LINE_A,
            productType: 'inventory',
            productRevenueAccountId: 'gl-rev-prod-a',
          },
        ],
        4: [],
        5: [],
        6: [{ shipmentId: 's', stateCode: 'dispatched' }],
        7: [{ salesOrderLineId: 'line-001', quantityShipped: '10' }],
        8: GL_ACCTS,
      });

      await service.createInvoice('order-001', {}, 'admin');

      expect(mockGlService.postJournalEntry).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            accountCode: '4200', // Customer preference
            credit: 250,
          }),
        ]),
        expect.anything(),
      );
    });

    it('should split GL lines for mixed product groups', async () => {
      mockRevenuePrecedence = 'product_first';
      mockSelectChain({
        1: [SHIPPED_ORDER],
        2: [CUSTOMER],
        3: [
          {
            ...ORDER_LINE_A,
            productType: 'inventory',
            productRevenueAccountId: 'gl-rev-prod-a',
          },
          {
            ...ORDER_LINE_B,
            productType: 'inventory',
            productRevenueAccountId: 'gl-rev-prod-b',
          },
        ],
        4: [],
        5: [],
        6: [{ shipmentId: 's', stateCode: 'dispatched' }],
        7: [
          { salesOrderLineId: 'line-001', quantityShipped: '10' },
          { salesOrderLineId: 'line-002', quantityShipped: '5' },
        ],
        8: GL_ACCTS,
      });

      await service.createInvoice('order-001', {}, 'admin');

      const lines = mockGlService.postJournalEntry.mock.calls[0][0];
      const revenueLines = lines.filter((l: any) => l.credit > 0);

      expect(revenueLines).toHaveLength(2);
      expect(revenueLines).toContainEqual(
        expect.objectContaining({ accountCode: '4101', credit: 250 }),
      );
      expect(revenueLines).toContainEqual(
        expect.objectContaining({ accountCode: '4102', credit: 500 }),
      );
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
      mockSelectChain({
        1: [MOCK_INVOICE],
        2: [{ ...MOCK_INVOICE_LINE, invoiceId: 'inv-001' }],
      });

      const result = await service.findByOrder('order-001');
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('invoiceId', 'inv-001');
      expect((result[0] as any).lines).toHaveLength(1);
    });
  });

  // =========================================================================
  // findActiveInvoices
  // =========================================================================

  describe('findActiveInvoices', () => {
    it('should query with default parameters', async () => {
      mockSelectChain({ 1: [] });
      const result = await service.findActiveInvoices({});
      expect(result).toEqual([]);
    });

    it('should return invoices when data exists', async () => {
      mockSelectChain({
        1: [
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
        ],
      });

      const result = await service.findActiveInvoices({ days: 7 });
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('invoiceNumber', 'INV-20260323-0001');
    });
  });
});
