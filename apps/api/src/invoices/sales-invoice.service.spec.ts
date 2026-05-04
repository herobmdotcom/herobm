import { Test, TestingModule } from '@nestjs/testing';
import { SalesInvoiceService } from './sales-invoice.service';
import { GlService } from '../gl/gl.service';
import { TaxCategoriesService } from '../tax/tax-categories.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { NotFoundException, BadRequestException } from '@nestjs/common';

import { AppConfigService } from '../settings/app-config.service';

jest.mock('../orders/order-lifecycle-rules', () => ({
  evaluateLifecycleRules: jest.fn().mockResolvedValue([]),
}));

let mockRevenuePrecedence = 'product_first';
const mockAppConfigService = {
  revenueRoutingPrecedence: jest
    .fn()
    .mockImplementation(() => mockRevenuePrecedence),
  expenseRoutingPrecedence: jest.fn().mockReturnValue('product_first'),
  nonStockBillingMode: jest.fn().mockReturnValue('per_shipment'),
};

import { MockDrizzle } from '../../test/utils/mock-drizzle';
import { setupTestModule } from '../../test/utils/test-module';

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
  let mockDb: MockDrizzle;
  let mockGlService: any;

  beforeEach(async () => {
    jest.clearAllMocks();

    mockGlService = {
      getSettings: jest.fn().mockResolvedValue(null),
      postJournalEntry: jest
        .fn()
        .mockResolvedValue({ journalEntryId: 'je-001' }),
    };

    const module: TestingModule = await setupTestModule([
      SalesInvoiceService,
      { provide: AppConfigService, useValue: mockAppConfigService },
      { provide: GlService, useValue: mockGlService },
      {
        provide: TaxCategoriesService,
        useValue: {
          getById: jest.fn().mockResolvedValue({ rate: '0' }),
          getByCode: jest.fn().mockResolvedValue({ rate: '0' }),
        },
      },
    ]).compile();

    service = module.get<SalesInvoiceService>(SalesInvoiceService);
    mockDb = module.get<MockDrizzle>(DRIZZLE);
  });

  afterEach(() => {
    mockDb.clearMocks();
  });

  // =========================================================================
  // createInvoice — state validation
  // =========================================================================

  describe('createInvoice — state validation', () => {
    it('should reject if order is not found', async () => {
      mockDb.onTable('sales_orders', []);
      await expect(
        service.createInvoice('nonexistent', {}, 'admin'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject if order is in draft state', async () => {
      mockDb.onTable('sales_orders', [
        { ...SHIPPED_ORDER, stateCode: 'draft' },
      ]);
      await expect(
        service.createInvoice('order-001', {}, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject if order is in confirmed state', async () => {
      mockDb.onTable('sales_orders', [
        { ...SHIPPED_ORDER, stateCode: 'confirmed' },
      ]);
      await expect(
        service.createInvoice('order-001', {}, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject if order is already invoiced', async () => {
      mockDb.onTable('sales_orders', [
        { ...SHIPPED_ORDER, stateCode: 'invoiced' },
      ]);
      await expect(
        service.createInvoice('order-001', {}, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should accept orders in shipped state', async () => {
      mockDb.onTable('sales_orders', [SHIPPED_ORDER]);
      mockDb.onTable('customers', [CUSTOMER]);
      mockDb.onTable('sales_order_lines', [
        { ...ORDER_LINE_A, productType: 'inventory' },
      ]);
      mockDb.onTable('sales_order_shipments', [
        { shipmentId: 's', stateCode: 'dispatched' },
      ]);
      mockDb.onTable('sales_order_shipment_lines', [
        { salesOrderLineId: 'line-001', quantityShipped: '10' },
      ]);

      const result = await service.createInvoice('order-001', {}, 'admin');
      expect(result).toBeDefined();
    });
  });

  // =========================================================================
  // createInvoice — quantity validation
  // =========================================================================

  describe('createInvoice — quantity validation', () => {
    it('should reject if order has no lines', async () => {
      mockDb.onTable('sales_orders', [SHIPPED_ORDER]);
      mockDb.onTable('customers', [CUSTOMER]);
      mockDb.onTable('sales_order_lines', []);
      await expect(
        service.createInvoice('order-001', {}, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject invoicing more than shipped quantity', async () => {
      mockDb.onTable('sales_orders', [SHIPPED_ORDER]);
      mockDb.onTable('accounts', [CUSTOMER]);
      mockDb.onTable('sales_order_lines', [
        { ...ORDER_LINE_A, productType: 'inventory' },
      ]);
      mockDb.onTable('sales_order_shipments', [
        { shipmentId: 'ship-001', stateCode: 'dispatched' },
      ]);
      mockDb.onTable('sales_order_shipment_lines', [
        { salesOrderLineId: 'line-001', quantityShipped: '5' },
      ]);

      await expect(
        service.createInvoice(
          'order-001',
          { lines: [{ salesOrderLineId: 'line-001', quantityToInvoice: 8 }] },
          'admin',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject if nothing available to invoice (all zero qty)', async () => {
      mockDb.onTable('sales_orders', [SHIPPED_ORDER]);
      mockDb.onTable('accounts', [CUSTOMER]);
      mockDb.onTable('sales_order_lines', [
        { ...ORDER_LINE_A, productType: 'inventory' },
      ]);
      mockDb.onTable('sales_order_shipments', []);

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

      mockDb.onTable('sales_orders', [SHIPPED_ORDER]);
      mockDb.onTable('sales_order_shipments', [
        { shipmentId: 's', stateCode: 'dispatched' },
      ]);
      mockDb.onTable('gl_accounts', GL_ACCTS);
    });

    it('should fallback to system default when no other accounts are set', async () => {
      mockDb.onTable('accounts', [CUSTOMER]);
      mockDb.onTable('sales_order_lines', [
        {
          ...ORDER_LINE_A,
          productType: 'inventory',
          productRevenueAccountId: null,
        },
      ]);
      mockDb.onTable('sales_order_shipment_lines', [
        { salesOrderLineId: 'line-001', quantityShipped: '10' },
      ]);

      await service.createInvoice('order-001', {}, 'admin');

      expect(mockGlService.postJournalEntry).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            accountCode: '4000', // System default
            credit: 250,
          }),
        ]),
        expect.objectContaining({ actor: 'admin' }),
        expect.anything(),
      );
    });

    it('should obey product_first precedence', async () => {
      mockRevenuePrecedence = 'product_first';
      mockDb.onTable('accounts', [
        { ...CUSTOMER, defaultRevenueAccountId: 'gl-rev-cust' },
      ]);
      mockDb.onTable('sales_order_lines', [
        {
          ...ORDER_LINE_A,
          productType: 'inventory',
          productRevenueAccountId: 'gl-rev-prod-a',
        },
      ]);
      mockDb.onTable('sales_order_shipment_lines', [
        { salesOrderLineId: 'line-001', quantityShipped: '10' },
      ]);

      await service.createInvoice('order-001', {}, 'admin');

      expect(mockGlService.postJournalEntry).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            accountCode: '4101', // Product preference
            credit: 250,
          }),
        ]),
        expect.anything(),
        expect.anything(),
      );
    });

    it('should obey customer_first precedence', async () => {
      mockRevenuePrecedence = 'customer_first';
      mockDb.onTable('accounts', [
        { ...CUSTOMER, defaultRevenueAccountId: 'gl-rev-cust' },
      ]);
      mockDb.onTable('sales_order_lines', [
        {
          ...ORDER_LINE_A,
          productType: 'inventory',
          productRevenueAccountId: 'gl-rev-prod-a',
        },
      ]);
      mockDb.onTable('sales_order_shipment_lines', [
        { salesOrderLineId: 'line-001', quantityShipped: '10' },
      ]);

      await service.createInvoice('order-001', {}, 'admin');

      expect(mockGlService.postJournalEntry).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            accountCode: '4200', // Customer preference
            credit: 250,
          }),
        ]),
        expect.anything(),
        expect.anything(),
      );
    });

    it('should split GL lines for mixed product groups', async () => {
      mockRevenuePrecedence = 'product_first';
      mockDb.onTable('accounts', [CUSTOMER]);
      mockDb.onTable('sales_order_lines', [
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
      ]);
      mockDb.onTable('sales_order_shipment_lines', [
        { salesOrderLineId: 'line-001', quantityShipped: '10' },
        { salesOrderLineId: 'line-002', quantityShipped: '5' },
      ]);

      await service.createInvoice('order-001', {}, 'admin');

      const lines = mockGlService.postJournalEntry.mock.calls[0][0];
      const revenueLines = lines.filter((l: any) => l.credit > 0);

      expect(revenueLines).toHaveLength(2);
      expect(revenueLines).toContainEqual(
        expect.objectContaining({ accountCode: '4102', credit: 500 }),
      );
    });

    it('should route dimensions from customer group when product has none', async () => {
      mockDb.onTable('accounts', [
        {
          ...CUSTOMER,
          defaultCostCenterId: 'cc-cust',
          defaultActivityId: 'act-cust',
        },
      ]);
      mockDb.onTable('sales_order_lines', [
        {
          ...ORDER_LINE_A,
          productType: 'inventory',
          productCostCenterId: null,
          productActivityId: null,
        },
      ]);
      mockDb.onTable('sales_order_shipment_lines', [
        { salesOrderLineId: 'line-001', quantityShipped: '10' },
      ]);

      await service.createInvoice('order-001', {}, 'admin');

      const lines = mockGlService.postJournalEntry.mock.calls[0][0];
      lines.forEach((l: any) => {
        expect(l.costCenterId).toBe('cc-cust');
        expect(l.activityId).toBe('act-cust');
      });
    });

    it('should prioritize product dimensions over customer dimensions', async () => {
      mockDb.onTable('accounts', [
        {
          ...CUSTOMER,
          defaultCostCenterId: 'cc-cust',
          defaultActivityId: 'act-cust',
        },
      ]);
      mockDb.onTable('sales_order_lines', [
        {
          ...ORDER_LINE_A,
          productType: 'inventory',
          productCostCenterId: 'cc-prod',
          productActivityId: 'act-prod',
        },
      ]);
      mockDb.onTable('sales_order_shipment_lines', [
        { salesOrderLineId: 'line-001', quantityShipped: '10' },
      ]);

      await service.createInvoice('order-001', {}, 'admin');

      const lines = mockGlService.postJournalEntry.mock.calls[0][0];
      const revenueLine = lines.find((l: any) => l.credit > 0);
      expect(revenueLine.costCenterId).toBe('cc-prod');
      expect(revenueLine.activityId).toBe('act-prod');

      // AR line should still use customer dimensions
      const arLine = lines.find((l: any) => l.debit > 0);
      expect(arLine.costCenterId).toBe('cc-cust');
      expect(arLine.activityId).toBe('act-cust');
    });
  });

  // =========================================================================
  // findOne
  // =========================================================================

  describe('findOne', () => {
    it('should return invoice with hydrated lines', async () => {
      mockDb.onTable('sales_invoices', [MOCK_INVOICE]);
      mockDb.onTable('sales_invoice_lines', [
        { ...MOCK_INVOICE_LINE, productId: 'prod-001' },
      ]);
      const result = await service.findOne('inv-001');
      expect(result).toHaveProperty('invoiceId', 'inv-001');
      expect(result.lines).toHaveLength(1);
    });

    it('should throw NotFoundException for unknown invoice', async () => {
      mockDb.onTable('sales_invoices', []);
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
      mockDb.onTable('sales_invoices', []);
      const result = await service.findByOrder('order-001');
      expect(result).toEqual([]);
    });

    it('should return invoices with hydrated lines', async () => {
      mockDb.onTable('sales_invoices', [MOCK_INVOICE]);
      mockDb.onTable('sales_invoice_lines', [
        { ...MOCK_INVOICE_LINE, invoiceId: 'inv-001' },
      ]);

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
      mockDb.onTable('sales_invoices', []);
      const result = await service.findActiveInvoices({});
      expect(result).toEqual([]);
    });

    it('should return invoices when data exists', async () => {
      mockDb.onTable('sales_invoices', [
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

      const result = await service.findActiveInvoices({ days: 7 });
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('invoiceNumber', 'INV-20260323-0001');
    });
  });
});
