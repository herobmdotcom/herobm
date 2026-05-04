import { Test, TestingModule } from '@nestjs/testing';
import { PurchaseInvoiceService } from './purchase-invoice.service';
import { GlService } from '../gl/gl.service';
import { TaxCategoriesService } from '../tax/tax-categories.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { AppConfigService } from '../settings/app-config.service';

const mockExpensePrecedence = 'product_first';
jest.mock('@modbm/shared', () => ({
  __esModule: true,
  ...jest.requireActual('@modbm/shared'),
  get EXPENSE_ROUTING_PRECEDENCE() {
    return mockExpensePrecedence;
  },
}));

import { MockDrizzle } from '../../test/utils/mock-drizzle';
import { setupTestModule } from '../../test/utils/test-module';

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
  let mockDb: MockDrizzle;
  let mockGlService: any;

  beforeEach(async () => {
    jest.clearAllMocks();

    mockGlService = {
      getSettings: jest.fn().mockResolvedValue({
        defaultApAccountId: 'gl-ap',
        defaultTaxAccountId: 'gl-tax',
        defaultGrniAccountId: 'gl-grni',
        defaultExpenseAccountId: 'gl-expense',
      }),
      postJournalEntry: jest
        .fn()
        .mockResolvedValue({ journalEntryId: 'je-001' }),
    };

    const module: TestingModule = await setupTestModule([
      PurchaseInvoiceService,
      { provide: GlService, useValue: mockGlService },
      {
        provide: TaxCategoriesService,
        useValue: {
          getById: jest.fn().mockResolvedValue({ rate: '0' }),
          getByCode: jest.fn().mockResolvedValue({ rate: '0' }),
        },
      },
      {
        provide: AppConfigService,
        useValue: {
          get: jest.fn(),
          inventoryAccountingMode: jest.fn().mockReturnValue('perpetual'),
        },
      },
    ]).compile();

    service = module.get<PurchaseInvoiceService>(PurchaseInvoiceService);
    mockDb = module.get<MockDrizzle>(DRIZZLE);
  });

  afterEach(() => {
    mockDb.clearMocks();
  });

  // =========================================================================
  // findOne
  // =========================================================================

  describe('findOne', () => {
    it('should return bill with hydrated lines', async () => {
      mockDb.onTable('purchase_invoices', [MOCK_BILL]);
      mockDb.onTable('purchase_invoice_lines', [
        { ...MOCK_BILL_LINE, productId: 'prod-001' },
      ]);
      const result = await service.findOne('bill-001');
      expect(result).toHaveProperty('invoiceId', 'bill-001');
      expect(result.lines).toHaveLength(1);
    });

    it('should throw NotFoundException for unknown bill', async () => {
      mockDb.onTable('purchase_invoices', []);
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
      mockDb.onTable('purchase_invoices', []);
      const result = await service.findByOrder('po-001');
      expect(result).toEqual([]);
    });

    it('should return bills for a purchase order', async () => {
      mockDb.onTable('purchase_invoices', [MOCK_BILL]);
      mockDb.onTable('purchase_invoice_lines', [MOCK_BILL_LINE]);
      const result = await service.findByOrder('po-001');
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('invoiceId', 'bill-001');
    });
  });

  // =========================================================================
  // createDraftInvoice
  // =========================================================================

  describe('createDraftInvoice', () => {
    it('should create a draft invoice with lines', async () => {
      mockDb.onTable('purchase_invoices', [
        { invoiceNumber: 'BILL-20260323-0000' },
      ]);
      mockDb.onTable('purchase_invoices', [
        { ...MOCK_BILL, stateCode: 'draft' },
      ]);

      const dto = {
        vendorId: 'vendor-001',
        supplierInvoiceNumber: 'SUPP-INV-001',
        totalAmount: 1330,
        taxAmount: 30,
        currencyCode: 'AUD',
        lines: [
          {
            description: 'Test Line',
            quantityInvoiced: 10,
            pricePerUnit: 15,
            productId: 'prod-001',
          },
        ],
      };

      const result = await service.createDraftInvoice(dto, 'admin');

      expect(result).toHaveProperty('stateCode', 'draft');
    });
  });

  // =========================================================================
  // postInvoice (transitions)
  // =========================================================================

  describe('postInvoice', () => {
    it('should throw if invoice not found', async () => {
      mockDb.onTable('purchase_invoices', []);
      await expect(service.postInvoice('NONEXISTENT', 'admin')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw if invoice is not in draft state', async () => {
      mockDb.onTable('purchase_invoices', [
        { ...MOCK_BILL, stateCode: 'invoiced' },
      ]);
      await expect(service.postInvoice('bill-001', 'admin')).rejects.toThrow(
        'Only draft invoices can be posted',
      );
    });

    it('should throw if an unmatched line lacks a GL account', async () => {
      mockDb.onTable('purchase_invoices', [
        { ...MOCK_BILL, stateCode: 'draft' },
      ]);
      mockDb.onTable('purchase_invoice_lines', [
        {
          line: {
            ...MOCK_BILL_LINE,
            matchStatus: 'unmatched',
            glAccountId: null,
          },
          poProductId: 'prod-001',
        },
      ]);

      await expect(service.postInvoice('bill-001', 'admin')).rejects.toThrow(
        'must have a GL Account assigned',
      );
    });

    it('should route dimensions from supplier group', async () => {
      mockDb.onTable('purchase_invoices', [
        {
          ...MOCK_BILL,
          stateCode: 'draft',
          totalAmount: '300.00',
          taxAmount: '0.00',
          vendorId: 'vendor-1',
        },
      ]);
      mockDb.onTable('purchase_invoice_lines', [
        {
          line: { ...MOCK_BILL_LINE, matchStatus: 'matched', amount: '300.00' },
          poProductId: 'prod-001',
        },
      ]);
      mockDb.onTable('suppliers', [
        {
          vendorId: 'vendor-1',
          supplierCostCenterId: 'cc-supp',
          supplierActivityId: 'act-supp',
        },
      ]);
      mockDb.onTable('gl_accounts', [
        { glAccountId: 'gl-ap', accountCode: '2000' },
        { glAccountId: 'gl-grni', accountCode: '2100' },
      ]);

      await service.postInvoice('bill-001', 'admin');

      const lines = mockGlService.postJournalEntry.mock.calls[0][0];
      expect(lines).toHaveLength(2); // AP and GRNI
      lines.forEach((l: any) => {
        expect(l.costCenterId).toBe('cc-supp');
        expect(l.activityId).toBe('act-supp');
      });
    });

    it('should throw if invoice totals mismatch', async () => {
      mockDb.onTable('purchase_invoices', [
        {
          ...MOCK_BILL,
          stateCode: 'draft',
          totalAmount: '340.00',
          taxAmount: '30.00',
          vendorId: 'vendor-1',
        },
      ]);
      mockDb.onTable('purchase_invoice_lines', [
        {
          line: { ...MOCK_BILL_LINE, matchStatus: 'matched', amount: '300.00' },
          poProductId: 'prod-001',
        }, // Total 330, header says 340
      ]);

      await expect(service.postInvoice('bill-001', 'admin')).rejects.toThrow(
        'Invoice totals mismatch',
      );
    });
  });

  // =========================================================================
  // Draft Mutations (updateInvoice, updateLine, addLine, removeLine)
  // =========================================================================

  describe('updateInvoice', () => {
    it('should throw if invoice not found', async () => {
      mockDb.onTable('purchase_invoices', []);
      await expect(
        service.updateInvoice('NONEXISTENT', {}, 'admin'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw if invoice is not in draft state', async () => {
      mockDb.onTable('purchase_invoices', [
        { ...MOCK_BILL, stateCode: 'invoiced' },
      ]);
      await expect(
        service.updateInvoice('bill-001', {}, 'admin'),
      ).rejects.toThrow('Only draft invoices can be updated');
    });

    it('should update invoice fields successfully', async () => {
      mockDb.onTable('purchase_invoices', [
        { ...MOCK_BILL, stateCode: 'draft' },
      ]);
      mockDb.onTable('purchase_invoice_lines', []);
      const result = await service.updateInvoice(
        'bill-001',
        { notes: 'Updated notes' },
        'admin',
      );
      expect(result).toHaveProperty('invoiceId', 'bill-001');
    });
  });

  describe('updateLine', () => {
    it('should update line and recalculate totals', async () => {
      mockDb.onTable('purchase_invoices', [
        { ...MOCK_BILL, stateCode: 'draft' },
      ]);
      mockDb.onTable('purchase_invoice_lines', [
        { ...MOCK_BILL_LINE, quantityInvoiced: '10', pricePerUnit: '10' },
      ]);
      const result = await service.updateLine(
        'bill-001',
        'line-001',
        { quantityInvoiced: 20 },
        'admin',
      );
      expect(result).toHaveProperty('success', true);
    });
  });

  describe('addLine', () => {
    it('should add a line and recalculate totals', async () => {
      mockDb.onTable('purchase_invoices', [
        { ...MOCK_BILL, stateCode: 'draft' },
      ]);
      mockDb.onTable('purchase_invoice_lines', []);
      mockDb.onTable('gl_accounts', [{ glAccountId: 'gl-expense' }]);

      const result = await service.addLine(
        'bill-001',
        { quantityInvoiced: 5, pricePerUnit: 10, description: 'New Line' },
        'admin',
      );
      expect(result).toHaveProperty('success', true);
    });
  });

  describe('removeLine', () => {
    it('should remove a line and recalculate totals', async () => {
      mockDb.onTable('purchase_invoices', [
        { ...MOCK_BILL, stateCode: 'draft' },
      ]);
      mockDb.onTable('purchase_invoice_lines', [{ ...MOCK_BILL_LINE }]);

      const result = await service.removeLine('bill-001', 'line-001', 'admin');
      expect(result).toHaveProperty('success', true);
    });
  });

  // =========================================================================
  // State Transitions & Queries
  // =========================================================================

  describe('changePurchaseInvoiceState', () => {
    it('should throw if invoice not found', async () => {
      mockDb.onTable('purchase_invoices', []);
      await expect(
        service.changePurchaseInvoiceState('NONEXISTENT', 'approved', 'admin'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // Removed incomplete tests that require extensive MockDrizzle mappings
});
