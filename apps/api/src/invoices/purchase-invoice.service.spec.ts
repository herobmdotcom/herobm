import { Test, TestingModule } from '@nestjs/testing';
import { PurchaseInvoiceService } from './purchase-invoice.service';
import { GlService } from '../gl/gl.service';
import { TaxCategoriesService } from '../tax/tax-categories.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { NotFoundException, BadRequestException } from '@nestjs/common';

let mockExpensePrecedence = 'product_first';
jest.mock('@modbm/shared', () => ({
  __esModule: true,
  ...jest.requireActual('@modbm/shared'),
  get EXPENSE_ROUTING_PRECEDENCE() {
    return mockExpensePrecedence;
  },
}));

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

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const RECEIVED_PO = {
  purchaseOrderId: 'po-001',
  orderNumber: 'PO-20260323-0001',
  stateCode: 'received',
  vendorId: 'vendor-001',
  currencyCode: 'AUD',
};

const PO_LINE_A = {
  purchaseOrderLineId: 'poline-001',
  purchaseOrderId: 'po-001',
  lineNumber: 1,
  productId: 'prod-001',
  productDescription: 'Raw Material A',
  quantity: '20',
  quantityReceived: '20',
  pricePerUnit: '15.00',
  tax: '10',
  amount: '300.00',
};

const PO_LINE_B = {
  purchaseOrderLineId: 'poline-002',
  purchaseOrderId: 'po-001',
  lineNumber: 2,
  productId: 'prod-002',
  productDescription: 'Raw Material B',
  quantity: '5',
  quantityReceived: '5',
  pricePerUnit: '200.00',
  tax: '0',
  amount: '1000.00',
};

const SUPPLIER = {
  erpnextId: 'SUPP-ERP-001',
  name: 'Steel Co',
};

const MOCK_BILL = {
  invoiceId: 'bill-001',
  invoiceNumber: 'BILL-20260323-0001',
  purchaseOrderId: 'po-001',
  totalAmount: '1330.00',
  taxAmount: '30.00',
  currencyCode: 'AUD',
  stateCode: 'invoiced',
  createdOn: new Date(),
};

const MOCK_BILL_LINE = {
  invoiceLineId: 'billline-001',
  invoiceId: 'bill-001',
  purchaseOrderLineId: 'poline-001',
  quantityInvoiced: '20',
  pricePerUnit: '15.00',
  amount: '300.00',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PurchaseInvoiceService', () => {
  let service: PurchaseInvoiceService;
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
        PurchaseInvoiceService,
        { provide: DRIZZLE, useValue: mockDb },
        { provide: GlService, useValue: mockGlService },
        {
          provide: TaxCategoriesService,
          useValue: {
            getById: jest.fn().mockResolvedValue({ rate: '0' }),
            getByCode: jest.fn().mockResolvedValue({ rate: '0' }),
          },
        },
      ],
    }).compile();

    service = module.get<PurchaseInvoiceService>(PurchaseInvoiceService);
  });

  // =========================================================================
  // createBill — state validation
  // =========================================================================

  describe('createBill — state validation', () => {
    it('should reject if purchase order is not found', async () => {
      mockSelectChain({ 1: [] });
      await expect(
        service.createBill(
          'nonexistent',
          { supplierInvoiceNumber: 'TEST-1' },
          'admin',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject if PO is in draft state', async () => {
      mockSelectChain({ 1: [{ ...RECEIVED_PO, stateCode: 'draft' }] });
      await expect(
        service.createBill(
          'po-001',
          { supplierInvoiceNumber: 'TEST-1' },
          'admin',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject if PO is in ordered state', async () => {
      mockSelectChain({ 1: [{ ...RECEIVED_PO, stateCode: 'ordered' }] });
      await expect(
        service.createBill(
          'po-001',
          { supplierInvoiceNumber: 'TEST-1' },
          'admin',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject if PO is already invoiced', async () => {
      mockSelectChain({ 1: [{ ...RECEIVED_PO, stateCode: 'invoiced' }] });
      await expect(
        service.createBill(
          'po-001',
          { supplierInvoiceNumber: 'TEST-1' },
          'admin',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should accept PO in received state', async () => {
      mockSelectChain({
        1: [RECEIVED_PO],
        2: [SUPPLIER],
        3: [{ line: PO_LINE_A, productExpenseAccountId: null }],
        4: [], // generateBillNumber
        5: [], // prior invoices
      });

      const txInsertQb = createMockQueryBuilder([MOCK_BILL]);
      mockDb.transaction = jest.fn().mockImplementation(async (cb: any) => {
        const tx = createMockTx();
        tx.insert = jest.fn().mockReturnValue(txInsertQb);
        tx.update = jest.fn().mockReturnValue(createMockQueryBuilder([]));
        return cb(tx);
      });

      const result = await service.createBill(
        'po-001',
        { supplierInvoiceNumber: 'TEST-1' },
        'admin',
      );
      expect(result).toHaveProperty('invoiceId', 'bill-001');
      expect(mockDb.transaction).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // createBill — line validation
  // =========================================================================

  describe('createBill — line validation', () => {
    it('should reject if PO has no lines', async () => {
      mockSelectChain({
        1: [RECEIVED_PO],
        2: [SUPPLIER],
        3: [], // empty lines
        4: [],
        5: [],
      });
      await expect(
        service.createBill(
          'po-001',
          { supplierInvoiceNumber: 'TEST-1' },
          'admin',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject invoicing more than received quantity', async () => {
      mockSelectChain({
        1: [RECEIVED_PO],
        2: [SUPPLIER],
        3: [{ line: PO_LINE_A, productExpenseAccountId: null }],
        4: [],
        5: [{ purchaseOrderLineId: 'poline-001', quantityInvoiced: '15' }], // 15 invoiced so far, 5 left.
      });

      await expect(
        service.createBill(
          'po-001',
          {
            supplierInvoiceNumber: 'TEST-1',
            lines: [
              { purchaseOrderLineId: 'poline-001', quantityToInvoice: 8 },
            ],
          },
          'admin',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // =========================================================================
  // createBill — GL Routing Rules
  // =========================================================================

  describe('createBill — GL Routing Rules', () => {
    const GL_ACCTS = [
      { glAccountId: 'gl-ap', accountCode: '2100' },
      { glAccountId: 'gl-exp-sys', accountCode: '5000' },
      { glAccountId: 'gl-exp-prod-a', accountCode: '5101' },
      { glAccountId: 'gl-exp-prod-b', accountCode: '5102' },
      { glAccountId: 'gl-exp-supp', accountCode: '5200' },
    ];

    beforeEach(() => {
      mockGlService.getSettings.mockResolvedValue({
        defaultApAccountId: 'gl-ap',
        defaultExpenseAccountId: 'gl-exp-sys',
      });

      const txInsertQb = createMockQueryBuilder([MOCK_BILL]);
      mockDb.transaction = jest.fn().mockImplementation(async (cb: any) => {
        const tx = createMockTx();
        tx.insert = jest.fn().mockReturnValue(txInsertQb);
        tx.update = jest.fn().mockReturnValue(createMockQueryBuilder([]));
        return cb(tx);
      });
    });

    it('should fallback to system default when no other accounts are set', async () => {
      mockSelectChain({
        1: [RECEIVED_PO], // PO
        2: [SUPPLIER], // Supplier (no accounts)
        3: [{ line: PO_LINE_A, productExpenseAccountId: null }], // Hydrated line
        4: [], // bill number
        5: [],
        6: GL_ACCTS, // GL lookup
      });

      await service.createBill(
        'po-001',
        { supplierInvoiceNumber: 'TEST-1' },
        'admin',
      );

      expect(mockGlService.postJournalEntry).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            accountCode: '5000', // System default
            debit: 300,
          }),
        ]),
        expect.objectContaining({ actor: 'admin' }),
      );
    });

    it('should obey product_first precedence', async () => {
      mockExpensePrecedence = 'product_first';
      mockSelectChain({
        1: [RECEIVED_PO],
        2: [{ ...SUPPLIER, defaultExpenseAccountId: 'gl-exp-supp' }], // Supplier has default
        3: [
          {
            line: PO_LINE_A,
            productExpenseAccountId: 'gl-exp-prod-a', // Product has default
          },
        ],
        4: [],
        5: [],
        6: GL_ACCTS,
      });

      await service.createBill(
        'po-001',
        { supplierInvoiceNumber: 'TEST-1' },
        'admin',
      );

      // Should prefer Product account
      expect(mockGlService.postJournalEntry).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            accountCode: '5101', // Product A
            debit: 300,
          }),
        ]),
        expect.anything(),
      );
    });

    it('should obey supplier_first precedence', async () => {
      mockExpensePrecedence = 'supplier_first';
      mockSelectChain({
        1: [RECEIVED_PO],
        2: [{ ...SUPPLIER, defaultExpenseAccountId: 'gl-exp-supp' }],
        3: [{ line: PO_LINE_A, productExpenseAccountId: 'gl-exp-prod-a' }],
        4: [],
        5: [],
        6: GL_ACCTS,
      });

      await service.createBill(
        'po-001',
        { supplierInvoiceNumber: 'TEST-1' },
        'admin',
      );

      // Should prefer Supplier account
      expect(mockGlService.postJournalEntry).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            accountCode: '5200', // Supplier default
            debit: 300,
          }),
        ]),
        expect.anything(),
      );
    });

    it('should split GL lines for mixed product groups', async () => {
      mockExpensePrecedence = 'product_first';
      mockSelectChain({
        1: [RECEIVED_PO],
        2: [SUPPLIER],
        3: [
          { line: PO_LINE_A, productExpenseAccountId: 'gl-exp-prod-a' }, // $300
          { line: PO_LINE_B, productExpenseAccountId: 'gl-exp-prod-b' }, // $1000
        ],
        4: [],
        5: [],
        6: GL_ACCTS,
      });

      await service.createBill(
        'po-001',
        { supplierInvoiceNumber: 'TEST-1' },
        'admin',
      );

      const lines = mockGlService.postJournalEntry.mock.calls[0][0];
      const expenseLines = lines.filter((l: any) => l.debit > 0);

      expect(expenseLines).toHaveLength(2);
      expect(expenseLines).toContainEqual(
        expect.objectContaining({ accountCode: '5101', debit: 300 }),
      );
      expect(expenseLines).toContainEqual(
        expect.objectContaining({ accountCode: '5102', debit: 1000 }),
      );
    });
  });

  // =========================================================================
  // findOne
  // =========================================================================

  describe('findOne', () => {
    it('should return bill with hydrated lines', async () => {
      mockSelectChain({
        1: [MOCK_BILL],
        2: [{ ...MOCK_BILL_LINE, productId: 'prod-001' }],
      });
      const result = await service.findOne('bill-001');
      expect(result).toHaveProperty('invoiceId', 'bill-001');
      expect(result.lines).toHaveLength(1);
    });

    it('should throw NotFoundException for unknown bill', async () => {
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
    it('should return empty array when no bills exist', async () => {
      mockSelectChain({ 1: [] });
      const result = await service.findByOrder('po-001');
      expect(result).toEqual([]);
    });

    it('should return bills for a purchase order', async () => {
      mockSelectChain({ 1: [MOCK_BILL] });
      const result = await service.findByOrder('po-001');
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('invoiceId', 'bill-001');
    });
  });
});
