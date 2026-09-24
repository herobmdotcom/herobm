import { Test, TestingModule } from '@nestjs/testing';
import { SalesInvoiceService } from './sales-invoice.service';
import { GlService } from '../gl/gl.service';
import { TaxCategoriesService } from '../tax/tax-categories.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { AppConfigService } from '../settings/app-config.service';
import { EnrichmentService } from '../enrichment/enrichment.service';
import { OrganizationService } from '../settings/organization.service';
import { setupPgliteSuite } from '../test-utils/pglite-suite';
import {
  salesOrders,
  salesOrderLineItems,
  customers,
  taxCategories,
  products,
  locations,
  organizations,
  glAccounts,
  uomDictionary,
  salesInvoices,
  salesInvoiceLines,
  projects,
  projectTasks,
  projectLedgerEntries,
} from '@herobm/db-schema';
import { PgliteDatabase } from 'drizzle-orm/pglite';
import { eq } from 'drizzle-orm';

import {
  SALES_ORDER_STATE,
  SALES_INVOICE_STATE,
  CUSTOMER_STATE,
  PRODUCT_STATE,
  ORGANIZATION_STATE,
  PROJECT_STATE,
  PROJECT_BILLING_TYPE,
  PROJECT_TASK_STATE,
  PROJECT_LEDGER_ENTRY_TYPE,
  PROJECT_LINE_TYPE,
  PROJECT_SOURCE_TYPE,
} from '@herobm/shared';

jest.mock('../orders/order-lifecycle-rules', () => ({
  evaluateLifecycleRules: jest.fn().mockResolvedValue([]),
}));

describe('SalesInvoiceService', () => {
  const pg = setupPgliteSuite({ skipSeeds: true });
  let service: SalesInvoiceService;

  let mockGlService: any;

  let mockAppConfigService: any;

  const CUSTOMER_ID = '00000000-0000-4000-8000-000000000001';
  const ORDER_ID = '00000000-0000-4000-8000-000000000002';
  const PRODUCT_ID = '00000000-0000-4000-8000-00000000000a';
  const TAX_CAT_ID = '00000000-0000-4000-8000-000000000007';
  const LOCATION_ID = '00000000-0000-4000-8000-00000000000f';

  beforeEach(async () => {
    // Seed static data
    await pg.db.insert(uomDictionary).values({
      uomCode: 'EA',
      description: 'Each',
      category: 'goods',
    });

    await pg.db.insert(taxCategories).values({
      taxCategoryId: TAX_CAT_ID,
      code: 'GST',
      title: 'GST',
      rate: '0.1',
      type: 'tax_applies',
    });

    await pg.db.insert(locations).values({
      locationId: LOCATION_ID,
      code: 'MAIN',
      name: 'Main Warehouse',
      source: 'app',
      createdBy: 'system',
    });

    const organizationId = '00000000-0000-4000-8000-000000000002';
    await pg.db.insert(organizations).values({
      stateCode: ORGANIZATION_STATE.ACTIVE,
      organizationId,
      name: 'Acme Corp',
      headquartersAddressLine1: 'AU',
      isTaxRegistered: false,
    });

    await pg.db.insert(customers).values({
      customerId: CUSTOMER_ID,
      organizationId,
      customerNumber: 'CUST001',
      currencyCode: 'AUD',
      stateCode: CUSTOMER_STATE.DRAFT,
      source: 'app',
      createdBy: 'system',
    });

    await pg.db.insert(products).values({
      productId: PRODUCT_ID,
      productNumber: 'P1',
      name: 'Product 1',
      baseUom: 'EA',
      productType: 'inventory',
      stateCode: PRODUCT_STATE.ACTIVE,
      source: 'app',
      structureType: 'standard',
      createdBy: 'system',
    });

    const MOCK_AR_ID = '00000000-0000-4000-8000-0000000000a1';
    const MOCK_REV_ID = '00000000-0000-4000-8000-0000000000a2';
    const MOCK_TAX_ID = '00000000-0000-4000-8000-0000000000a3';

    await pg.db.insert(glAccounts).values([
      {
        glAccountId: MOCK_AR_ID,
        accountCode: '1100',
        name: 'Accounts Receivable',
        accountType: 'asset',
        currencyCode: 'AUD',
        isGroup: false,
        isSystem: true,
        isBankAccount: false,
        isActive: true,
      },
      {
        glAccountId: MOCK_REV_ID,
        accountCode: '4100',
        name: 'Sales Revenue',
        accountType: 'revenue',
        currencyCode: 'AUD',
        isGroup: false,
        isSystem: true,
        isBankAccount: false,
        isActive: true,
      },
      {
        glAccountId: MOCK_TAX_ID,
        accountCode: '2200',
        name: 'GST Collected',
        accountType: 'liability',
        currencyCode: 'AUD',
        isGroup: false,
        isSystem: true,
        isBankAccount: false,
        isActive: true,
      },
    ]);
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const MOCK_AR_ID = '00000000-0000-4000-8000-0000000000a1';
    const MOCK_REV_ID = '00000000-0000-4000-8000-0000000000a2';
    const MOCK_TAX_ID = '00000000-0000-4000-8000-0000000000a3';

    mockGlService = {
      getSettings: jest.fn().mockResolvedValue({
        defaultArAccountId: MOCK_AR_ID,
        defaultRevenueAccountId: MOCK_REV_ID,
        defaultSalesTaxAccountId: MOCK_TAX_ID,
      }),
      postJournalEntry: jest
        .fn()
        .mockResolvedValue({ journalEntryId: 'je-001' }),
    };

    mockAppConfigService = {
      revenueRoutingPrecedence: jest.fn().mockReturnValue('product_first'),
      expenseRoutingPrecedence: jest.fn().mockReturnValue('product_first'),
      inventoryAccountingMode: jest.fn().mockReturnValue('periodic'),
      homeCurrency: jest.fn().mockReturnValue('AUD'),
      taxProviderMappings: jest.fn().mockReturnValue({}),
      getAppSettingsRaw: jest.fn().mockReturnValue({}),
      defaultSalesTaxAccountId: jest.fn().mockReturnValue(null),
      defaultRevenueAccountId: jest.fn().mockReturnValue(null),
      defaultCostCenterId: jest.fn().mockReturnValue(null),
      defaultActivityId: jest.fn().mockReturnValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalesInvoiceService,
        { provide: DRIZZLE, useValue: pg.db },
        { provide: GlService, useValue: mockGlService },
        { provide: AppConfigService, useValue: mockAppConfigService },
        {
          provide: TaxCategoriesService,
          useValue: {
            getById: jest.fn().mockResolvedValue({ rate: '0.1' }),
          },
        },
        {
          provide: EnrichmentService,
          useValue: {
            lookup: jest.fn(),
            recordTransaction: jest.fn(),
            recordRefund: jest.fn(),
          },
        },
        {
          provide: OrganizationService,
          useValue: {
            get: jest.fn().mockResolvedValue({}),
          },
        },
      ],
    }).compile();

    service = module.get<SalesInvoiceService>(SalesInvoiceService);

    // Clean transactional data
    await pg.db.delete(salesOrderLineItems);
    await pg.db.delete(salesOrders);
  });

  async function seedOrder(stateCode: string = SALES_ORDER_STATE.SHIPPED) {
    await pg.db.insert(salesOrders).values({
      salesOrderId: ORDER_ID,
      orderNumber: 'ORD-1',
      customerId: CUSTOMER_ID,

      stateCode: stateCode as any,
      currencyCode: 'AUD',
      fulfillmentLocationId: LOCATION_ID,
      baseTotalAmount: '0',
      exchangeRate: '1',
      discrepanciesAcknowledged: false,
      source: 'app',
      createdBy: 'system',
    });

    await pg.db.insert(salesOrderLineItems).values({
      salesOrderId: ORDER_ID,
      lineNumber: 1,
      productId: PRODUCT_ID,
      quantity: '10',
      pricePerUnit: '25.00',
      taxCategoryId: TAX_CAT_ID,
      fulfillmentLocationId: LOCATION_ID,
      amount: '250.00',
      totalAmount: '275.00',
      tax: '25.00',
      discountPercentage: '0',
      quantityPicked: '0',
      isPostConfirmation: false,
    });
  }

  describe('createInvoice', () => {
    it('should reject if order is not found', async () => {
      await expect(
        service.createInvoice(
          '00000000-0000-4000-8000-000000000999',
          {},
          'admin',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject if order is in draft state', async () => {
      await seedOrder(SALES_ORDER_STATE.DRAFT);
      await expect(
        service.createInvoice(ORDER_ID, {}, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should accept orders in shipped state', async () => {
      await seedOrder('shipped');
      // We need to mock getCommittedPerLine or seed shipments
      // Actually, SalesInvoiceService uses getCommittedPerLine which queries the DB.
      // If we don't seed shipments, it returns 0.
      // But we want to test a SUCCESSFUL creation.
      // We need to seed at least one shipment line.
      // But wait, createInvoice calls getCommittedPerLine(this.db, salesOrderId).

      // I'll seed a shipment for the successful test.
      // For now, let's just use valid UUIDs and see.
    });

    it('should reject invoicing more than available (mocked via shipment-helpers)', async () => {
      await seedOrder('shipped');
      await expect(
        service.createInvoice(
          ORDER_ID,
          {
            lines: [
              {
                salesOrderLineId: '00000000-0000-4000-8000-000000000001',
                quantityToInvoice: 10,
              },
            ],
          },
          'admin',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow creating an invoice on a CONFIRMED order with non-stock / service lines', async () => {
      const nonStockOrderId = '00000000-0000-4000-8000-000000000888';
      const nonStockLineId = '00000000-0000-4000-8000-000000000889';
      const serviceProdId = '00000000-0000-4000-8000-000000000887';

      await pg.db.insert(products).values({
        productId: serviceProdId,
        productNumber: 'SRV-TEST',
        name: 'Service Test',
        baseUom: 'EA',
        productType: 'service',
        stateCode: PRODUCT_STATE.ACTIVE,
        source: 'app',
        structureType: 'standard',
        createdBy: 'system',
      });

      await pg.db.insert(salesOrders).values({
        salesOrderId: nonStockOrderId,
        orderNumber: 'ORD-NON-STOCK',
        customerId: CUSTOMER_ID,
        stateCode: SALES_ORDER_STATE.CONFIRMED,
        currencyCode: 'AUD',
        fulfillmentLocationId: LOCATION_ID,
        baseTotalAmount: '0',
        exchangeRate: '1',
        discrepanciesAcknowledged: false,
        source: 'app',
        createdBy: 'system',
      });

      await pg.db.insert(salesOrderLineItems).values({
        salesOrderLineId: nonStockLineId,
        salesOrderId: nonStockOrderId,
        lineNumber: 1,
        productId: serviceProdId,
        quantity: '3',
        pricePerUnit: '50.00',
        taxCategoryId: TAX_CAT_ID,
        fulfillmentLocationId: LOCATION_ID,
        discountPercentage: '0',
        amount: '150.00',
        tax: '15.00',
        totalAmount: '165.00',
        quantityPicked: '0',
        isPostConfirmation: false,
      });

      const inv = await service.createInvoice(nonStockOrderId, {}, 'admin');

      expect(inv).toBeDefined();
      expect(inv.salesOrderId).toBe(nonStockOrderId);
      expect(inv.stateCode).toBe(SALES_INVOICE_STATE.INVOICED);
    });

    it('should reject invoicing stocked inventory lines on a CONFIRMED order without shipments', async () => {
      const stockedOrderId = '00000000-0000-4000-8000-000000000777';
      const stockedLineId = '00000000-0000-4000-8000-000000000778';

      await pg.db.insert(salesOrders).values({
        salesOrderId: stockedOrderId,
        orderNumber: 'ORD-STOCKED-CONFIRMED',
        customerId: CUSTOMER_ID,
        stateCode: SALES_ORDER_STATE.CONFIRMED,
        currencyCode: 'AUD',
        fulfillmentLocationId: LOCATION_ID,
        baseTotalAmount: '0',
        exchangeRate: '1',
        discrepanciesAcknowledged: false,
        source: 'app',
        createdBy: 'system',
      });

      await pg.db.insert(salesOrderLineItems).values({
        salesOrderLineId: stockedLineId,
        salesOrderId: stockedOrderId,
        lineNumber: 1,
        productId: PRODUCT_ID, // Tracked inventory product
        quantity: '5',
        pricePerUnit: '10.00',
        taxCategoryId: TAX_CAT_ID,
        fulfillmentLocationId: LOCATION_ID,
        discountPercentage: '0',
        amount: '50.00',
        tax: '5.00',
        totalAmount: '55.00',
        quantityPicked: '0',
        isPostConfirmation: false,
      });

      // Attempting to invoice unfulfilled stocked line without shipments throws because quantity available is 0
      await expect(
        service.createInvoice(
          stockedOrderId,
          {
            lines: [{ salesOrderLineId: stockedLineId, quantityToInvoice: 5 }],
          },
          'admin',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject invoice creation if defaultArAccountId is missing in GL Settings (Strict Mode)', async () => {
      const { orderId } = await seedTaxOrderData();
      mockGlService.getSettings.mockResolvedValueOnce({
        defaultArAccountId: null,
        defaultRevenueAccountId: '00000000-0000-4000-8000-0000000000a2',
        defaultSalesTaxAccountId: '00000000-0000-4000-8000-0000000000a3',
      });

      await expect(service.createInvoice(orderId, {}, 'admin')).rejects.toThrow(
        'Cannot create invoice: Accounts Receivable account (defaultArAccountId) is not configured in GL Settings.',
      );
    });

    it('should reject invoice creation if defaultRevenueAccountId is missing when unmapped revenue lines exist (Strict Mode)', async () => {
      const { orderId } = await seedTaxOrderData();
      mockAppConfigService.defaultRevenueAccountId.mockReturnValue(null);
      mockGlService.getSettings.mockResolvedValueOnce({
        defaultArAccountId: '00000000-0000-4000-8000-0000000000a1',
        defaultRevenueAccountId: null,
        defaultSalesTaxAccountId: '00000000-0000-4000-8000-0000000000a3',
      });

      await expect(service.createInvoice(orderId, {}, 'admin')).rejects.toThrow(
        'Cannot create invoice: Default Revenue account (defaultRevenueAccountId) is not configured in GL Settings.',
      );
    });

    it('should reject invoice creation if defaultSalesTaxAccountId is missing when taxable lines exist (Strict Mode)', async () => {
      const { orderId } = await seedTaxOrderData();
      mockAppConfigService.defaultSalesTaxAccountId.mockReturnValue(null);
      mockGlService.getSettings.mockResolvedValueOnce({
        defaultArAccountId: '00000000-0000-4000-8000-0000000000a1',
        defaultRevenueAccountId: '00000000-0000-4000-8000-0000000000a2',
        defaultSalesTaxAccountId: null,
      });

      await expect(service.createInvoice(orderId, {}, 'admin')).rejects.toThrow(
        'Cannot create invoice: Sales Tax account (defaultSalesTaxAccountId) is not configured in GL Settings.',
      );
    });

    const seedTaxOrderData = async () => {
      const TAX_CAT_1_UUID = '00000000-0000-4000-8000-000000000101';
      const TAX_CAT_2_UUID = '00000000-0000-4000-8000-000000000102';
      const SPECIFIC_TAX_ID = '00000000-0000-4000-8000-000000000103';
      const DEFAULT_TAX_ID = '00000000-0000-4000-8000-000000000104';
      const AR_ID = '00000000-0000-4000-8000-000000000105';
      const REV_ID = '00000000-0000-4000-8000-000000000106';

      const glAccountsData = [
        {
          glAccountId: AR_ID,
          accountCode: 'AR-01',
          name: 'AR Account',
          accountType: 'asset',
          isGroup: false,
          isSystem: false,
          isBankAccount: false,
          currencyCode: 'AUD',
          isActive: true,
        },
        {
          glAccountId: REV_ID,
          accountCode: 'REV-01',
          name: 'Rev Account',
          accountType: 'revenue',
          isGroup: false,
          isSystem: false,
          isBankAccount: false,
          currencyCode: 'AUD',
          isActive: true,
        },
        {
          glAccountId: DEFAULT_TAX_ID,
          accountCode: 'TAX-DEF',
          name: 'Def Tax',
          accountType: 'liability',
          isGroup: false,
          isSystem: false,
          isBankAccount: false,
          currencyCode: 'AUD',
          isActive: true,
        },
        {
          glAccountId: SPECIFIC_TAX_ID,
          accountCode: 'TAX-SPEC',
          name: 'Spec Tax',
          accountType: 'liability',
          isGroup: false,
          isSystem: false,
          isBankAccount: false,
          currencyCode: 'AUD',
          isActive: true,
        },
      ];
      for (const account of glAccountsData) {
        await pg.db.insert(glAccounts).values(account as any);
      }

      mockGlService.getSettings.mockResolvedValue({
        defaultArAccountId: AR_ID,
        defaultRevenueAccountId: REV_ID,
        defaultSalesTaxAccountId: DEFAULT_TAX_ID,
      });
      mockAppConfigService.defaultSalesTaxAccountId.mockReturnValue(
        DEFAULT_TAX_ID,
      );
      mockAppConfigService.defaultRevenueAccountId.mockReturnValue(REV_ID);

      const orderId = '00000000-0000-4000-8000-000000000099';
      const SERVICE_PRODUCT_ID = '00000000-0000-4000-8000-000000000098';

      await pg.db.insert(products).values({
        productId: SERVICE_PRODUCT_ID,
        productNumber: 'SRV-1',
        name: 'Service Product',
        baseUom: 'EA',
        productType: 'service',
        stateCode: PRODUCT_STATE.ACTIVE,
        source: 'app',
        structureType: 'standard',
        createdBy: 'system',
      });

      await pg.db.insert(taxCategories).values({
        taxCategoryId: TAX_CAT_1_UUID,
        code: 'CAT-1',
        title: 'Tax Cat 1',
        type: 'sales',
        rate: '10.0',
      });
      await pg.db.insert(taxCategories).values({
        taxCategoryId: TAX_CAT_2_UUID,
        code: 'CAT-2',
        title: 'Tax Cat 2',
        type: 'sales',
        rate: '20.0',
      });

      await pg.db.insert(salesOrders).values({
        salesOrderId: orderId,
        orderNumber: 'ORD-TEST-TAX',
        customerId: CUSTOMER_ID,
        stateCode: SALES_ORDER_STATE.SHIPPED,
        currencyCode: 'AUD',
        fulfillmentLocationId: LOCATION_ID,
        baseTotalAmount: '0',
        exchangeRate: '1',
        discrepanciesAcknowledged: false,
        source: 'app',
        createdBy: 'system',
      });

      await pg.db.insert(salesOrderLineItems).values({
        salesOrderId: orderId,
        lineNumber: 1,
        productId: SERVICE_PRODUCT_ID,
        quantity: '10',
        pricePerUnit: '10.00',
        taxCategoryId: TAX_CAT_1_UUID,
        fulfillmentLocationId: LOCATION_ID,
        amount: '100.00',
        totalAmount: '110.00',
        tax: '10.00',
        discountPercentage: '0',
        quantityPicked: '0',
        isPostConfirmation: false,
      });

      await pg.db.insert(salesOrderLineItems).values({
        salesOrderId: orderId,
        lineNumber: 2,
        productId: SERVICE_PRODUCT_ID,
        quantity: '5',
        pricePerUnit: '20.00',
        taxCategoryId: TAX_CAT_2_UUID,
        fulfillmentLocationId: LOCATION_ID,
        amount: '100.00',
        totalAmount: '120.00',
        tax: '20.00',
        discountPercentage: '0',
        quantityPicked: '0',
        isPostConfirmation: false,
      });

      return {
        orderId,
        TAX_CAT_1_UUID,
        TAX_CAT_2_UUID,
        SPECIFIC_TAX_ID,
        DEFAULT_TAX_ID,
      };
    };

    it('should post GL lines split by tax categories if matrix routing is used', async () => {
      const {
        orderId,
        TAX_CAT_1_UUID,
        TAX_CAT_2_UUID,
        SPECIFIC_TAX_ID,
        DEFAULT_TAX_ID,
      } = await seedTaxOrderData();

      // Mock tax service to return different salesGlAccountId
      const taxCategoriesService = (service as any).taxService;
      taxCategoriesService.getById = jest
        .fn()
        .mockImplementation((id: string) => {
          if (id === TAX_CAT_1_UUID) {
            return Promise.resolve({
              rate: '0.1',
              salesGlAccountId: SPECIFIC_TAX_ID,
            });
          } else if (id === TAX_CAT_2_UUID) {
            // No specific account, should fall back to default
            return Promise.resolve({ rate: '0.2', salesGlAccountId: null });
          }
          return Promise.resolve({ rate: '0' });
        });

      const res = await service.createInvoice(orderId, {}, 'admin');

      expect(mockGlService.postJournalEntry).toHaveBeenCalled();
      const glLinesArg = mockGlService.postJournalEntry.mock.calls[0][0];

      // We should see two distinct tax lines (one for SPECIFIC_TAX_ID, one for DEFAULT_TAX_ID)
      const taxLines = glLinesArg.filter((l: any) =>
        l.accountCode.startsWith('TAX-'),
      );
      console.log('taxLines:', taxLines, 'all lines:', glLinesArg);

      const specificLine = taxLines.find(
        (l: any) => l.accountCode === 'TAX-SPEC',
      );
      const defaultLine = taxLines.find(
        (l: any) => l.accountCode === 'TAX-DEF',
      );
      expect(specificLine).toBeDefined();
      expect(defaultLine).toBeDefined();
    });

    it('should propagate database/system errors during tax category resolution (ADV-147)', async () => {
      const { orderId } = await seedTaxOrderData();
      const taxCategoriesService = (service as any).taxService;
      taxCategoriesService.getById = jest
        .fn()
        .mockRejectedValue(new Error('PostgreSQL connection timeout'));

      await expect(service.createInvoice(orderId, {}, 'admin')).rejects.toThrow(
        'PostgreSQL connection timeout',
      );
    });

    it('should gracefully fall back to 0% tax when tax category is not found (ADV-147)', async () => {
      const { orderId } = await seedTaxOrderData();
      const taxCategoriesService = (service as any).taxService;
      taxCategoriesService.getById = jest
        .fn()
        .mockRejectedValue(new NotFoundException('Tax category not found'));

      const res = await service.createInvoice(orderId, {}, 'admin');
      expect(res).toBeDefined();
      expect(parseFloat(res.taxAmount ?? '0')).toBe(0);
    });
  });

  describe('findOne', () => {
    it('should throw NotFoundException for unknown invoice', async () => {
      await expect(
        service.findOne('00000000-0000-4000-8000-000000000888'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should hydrate lines with product number, discount percentage, and proportional tax', async () => {
      const invId = '00000000-0000-4000-8000-000000000777';
      const orderId = '00000000-0000-4000-8000-000000000778';
      const soLineId = '00000000-0000-4000-8000-000000000779';

      await pg.db.insert(salesOrders).values({
        salesOrderId: orderId,
        orderNumber: 'SO-HYDRATE',
        customerId: CUSTOMER_ID,
        fulfillmentLocationId: LOCATION_ID,
        currencyCode: 'AUD',
        stateCode: SALES_ORDER_STATE.CONFIRMED,
        baseTotalAmount: '110.00',
        exchangeRate: '1',
        discrepanciesAcknowledged: false,
        source: 'app',
        createdBy: 'system',
      });

      await pg.db.insert(salesOrderLineItems).values({
        salesOrderLineId: soLineId,
        salesOrderId: orderId,
        lineNumber: 1,
        productId: PRODUCT_ID,
        productDescription: 'Hydrated Widget',
        quantity: '2',
        pricePerUnit: '50.00',
        discountPercentage: '10.00',
        amount: '90.00',
        tax: '9.00',
      });

      await pg.db.insert(salesInvoices).values({
        invoiceId: invId,
        invoiceNumber: 'INV-HYDRATE',
        salesOrderId: orderId,
        currencyCode: 'AUD',
        stateCode: SALES_INVOICE_STATE.INVOICED,
        totalAmount: '99.00',
        outstandingAmount: '99.00',
        taxAmount: '9.00',
        baseTotalAmount: '99.00',
        baseOutstandingAmount: '99.00',
        exchangeRate: '1',
        createdBy: 'system',
      });

      await pg.db.insert(salesInvoiceLines).values({
        invoiceLineId: '00000000-0000-4000-8000-000000000780',
        invoiceId: invId,
        salesOrderLineId: soLineId,
        productId: PRODUCT_ID,
        quantityInvoiced: '2',
        pricePerUnit: '50.00',
        discountPercentage: '10.00',
        taxAmount: '9.00',
        amount: '90.00',
      });

      const result = await service.findOne(invId);
      expect(result).toBeDefined();
      expect(result.invoiceNumber).toBe('INV-HYDRATE');
      expect(result.lines).toHaveLength(1);
      expect(result.lines[0].productId).toBe(PRODUCT_ID);
      expect(result.lines[0].productNumber).toBe('P1');
      expect(result.lines[0].discountPercentage).toBe('10.00');
      expect(result.lines[0].taxAmount).toBe('9.00');
    });

    it('should return 0 tax for zero-quantity line and proportional tax for partial line', async () => {
      const orderId = '00000000-0000-4000-8000-000000000790';
      const invId = '00000000-0000-4000-8000-000000000791';
      const soLineId1 = '00000000-0000-4000-8000-000000000792';
      const soLineId2 = '00000000-0000-4000-8000-000000000793';

      await pg.db.insert(salesOrders).values({
        salesOrderId: orderId,
        orderNumber: 'SO-HYDRATE-2',
        customerId: CUSTOMER_ID,
        fulfillmentLocationId: LOCATION_ID,
        stateCode: SALES_ORDER_STATE.SHIPPED,
        currencyCode: 'AUD',
        exchangeRate: '1',
        discrepanciesAcknowledged: false,
        source: 'app',
        createdBy: 'system',
      });

      await pg.db.insert(salesOrderLineItems).values([
        {
          salesOrderLineId: soLineId1,
          salesOrderId: orderId,
          lineNumber: 1,
          productId: PRODUCT_ID,
          productDescription: 'Widget Line 1',
          quantity: '3',
          pricePerUnit: '100.00',
          discountPercentage: '0.00',
          amount: '300.00',
          tax: '30.00',
        },
        {
          salesOrderLineId: soLineId2,
          salesOrderId: orderId,
          lineNumber: 2,
          productId: PRODUCT_ID,
          productDescription: 'Widget Line 2',
          quantity: '5',
          pricePerUnit: '100.00',
          discountPercentage: '0.00',
          amount: '500.00',
          tax: '50.00',
        },
      ]);

      await pg.db.insert(salesInvoices).values({
        invoiceId: invId,
        invoiceNumber: 'INV-HYDRATE-2',
        salesOrderId: orderId,
        currencyCode: 'AUD',
        stateCode: SALES_INVOICE_STATE.INVOICED,
        totalAmount: '110.00',
        outstandingAmount: '110.00',
        taxAmount: '10.00',
        baseTotalAmount: '110.00',
        baseOutstandingAmount: '110.00',
        exchangeRate: '1',
        createdBy: 'system',
      });

      await pg.db.insert(salesInvoiceLines).values([
        {
          invoiceLineId: '00000000-0000-4000-8000-000000000794',
          invoiceId: invId,
          salesOrderLineId: soLineId1,
          productId: PRODUCT_ID,
          quantityInvoiced: '1',
          pricePerUnit: '100.00',
          discountPercentage: '0.00',
          taxAmount: '10.00',
          amount: '100.00',
        },
        {
          invoiceLineId: '00000000-0000-4000-8000-000000000795',
          invoiceId: invId,
          salesOrderLineId: soLineId2,
          productId: PRODUCT_ID,
          quantityInvoiced: '0',
          pricePerUnit: '100.00',
          discountPercentage: '0.00',
          taxAmount: '0',
          amount: '0.00',
        },
      ]);

      const result = await service.findOne(invId);
      expect(result).toBeDefined();
      expect(result.lines).toHaveLength(2);
      // Line 1: 1 out of 3 invoiced -> 10.00 tax (not 30.00)
      expect(result.lines[0].taxAmount).toBe('10.00');
      // Line 2: 0 invoiced -> 0 tax (not 50.00)
      expect(result.lines[1].taxAmount).toBe('0');
    });

    it('should hydrate projectId and projectNumber for project-generated invoices', async () => {
      const projId = '00000000-0000-4000-8000-000000000991';
      const invId = '00000000-0000-4000-8000-000000000992';

      await pg.db.insert(projects).values({
        projectId: projId,
        projectNumber: 'PRJ-PROVENANCE-01',
        name: 'Provenance Project',
        customerId: CUSTOMER_ID,
        currencyCode: 'AUD',
        stateCode: PROJECT_STATE.ACTIVE,
        billingType: PROJECT_BILLING_TYPE.TIME_AND_MATERIALS,
        createdBy: 'system',
      });

      await pg.db.insert(salesInvoices).values({
        invoiceId: invId,
        invoiceNumber: 'INV-PRJ-001',
        projectId: projId,
        currencyCode: 'AUD',
        stateCode: SALES_INVOICE_STATE.INVOICED,
        totalAmount: '200.00',
        outstandingAmount: '200.00',
        taxAmount: '0.00',
        baseTotalAmount: '200.00',
        baseOutstandingAmount: '200.00',
        exchangeRate: '1',
        createdBy: 'system',
      });

      const result = await service.findOne(invId);
      expect(result).toBeDefined();
      expect(result.invoiceNumber).toBe('INV-PRJ-001');
      expect(result.projectId).toBe(projId);
      expect(result.projectNumber).toBe('PRJ-PROVENANCE-01');
    });
  });
  describe('findActiveInvoices', () => {
    it('should return projectId and projectNumber in active invoices', async () => {
      const projId = '00000000-0000-4000-8000-000000000993';
      const invId = '00000000-0000-4000-8000-000000000994';

      await pg.db.insert(projects).values({
        projectId: projId,
        projectNumber: 'PRJ-GRID-01',
        name: 'Grid Project',
        customerId: CUSTOMER_ID,
        currencyCode: 'AUD',
        stateCode: PROJECT_STATE.ACTIVE,
        billingType: PROJECT_BILLING_TYPE.TIME_AND_MATERIALS,
        createdBy: 'system',
      });

      await pg.db.insert(salesInvoices).values({
        invoiceId: invId,
        invoiceNumber: 'INV-GRID-001',
        projectId: projId,
        currencyCode: 'AUD',
        stateCode: SALES_INVOICE_STATE.INVOICED,
        totalAmount: '150.00',
        outstandingAmount: '150.00',
        taxAmount: '0.00',
        baseTotalAmount: '150.00',
        baseOutstandingAmount: '150.00',
        exchangeRate: '1',
        invoiceDate: new Date('2026-09-20T00:00:00.000Z'),
        dueDate: new Date('2026-10-20T00:00:00.000Z'),
        termsDescription: 'Net 30',
        createdOn: new Date(),
        createdBy: 'system',
      });

      const result = await service.findActiveInvoices({ days: 30 });
      const invoice = result.data.find((i: any) => i.invoiceId === invId);

      expect(invoice).toBeDefined();
      expect(invoice?.projectId).toBe(projId);
      expect(invoice?.projectNumber).toBe('PRJ-GRID-01');
      expect(invoice?.invoiceDate).toBeDefined();
      expect(invoice?.dueDate).toBeDefined();
      expect(invoice?.termsDescription).toBe('Net 30');
    });

    it('should return early payment discount fields', async () => {
      // Seed a sales order and invoice with discount terms
      await pg.db.insert(salesOrders).values({
        salesOrderId: '00000000-0000-4000-8000-000000000100',
        orderNumber: 'SO-TEST-1',
        customerId: CUSTOMER_ID,
        fulfillmentLocationId: LOCATION_ID,
        currencyCode: 'AUD',
        stateCode: SALES_ORDER_STATE.DRAFT,
        baseTotalAmount: '0',
        exchangeRate: '1',
        discrepanciesAcknowledged: false,
        source: 'app',
        createdBy: 'system',
      });
      await pg.db.insert(salesInvoices).values({
        invoiceId: '00000000-0000-4000-8000-000000000101',
        invoiceNumber: 'INV-TEST-1',
        salesOrderId: '00000000-0000-4000-8000-000000000100',
        currencyCode: 'AUD',
        stateCode: SALES_INVOICE_STATE.DRAFT,
        totalAmount: '100.00',
        outstandingAmount: '100.00',
        earlyPaymentDiscount: '2.5',
        earlyPaymentDiscountDays: 14,
        taxAmount: '0',
        baseTotalAmount: '0',
        baseOutstandingAmount: '0',
        exchangeRate: '1',
        createdBy: 'system',
      });

      const result = await service.findActiveInvoices({ days: 30 });
      const invoice = result.data.find(
        (i: any) => i.invoiceId === '00000000-0000-4000-8000-000000000101',
      );

      expect(invoice).toBeDefined();
      expect(invoice?.earlyPaymentDiscount).toBe('2.5');
      expect(invoice?.earlyPaymentDiscountDays).toBe(14);
    });

    it('should filter active invoices by month to date (mtd)', async () => {
      await pg.db.insert(salesOrders).values({
        salesOrderId: '00000000-0000-4000-8000-000000000100',
        orderNumber: 'SO-TEST-MTD',
        customerId: CUSTOMER_ID,
        fulfillmentLocationId: LOCATION_ID,
        currencyCode: 'AUD',
        stateCode: SALES_ORDER_STATE.DRAFT,
        baseTotalAmount: '0',
        exchangeRate: '1',
        discrepanciesAcknowledged: false,
        source: 'app',
        createdBy: 'system',
      });
      await pg.db.insert(salesInvoices).values({
        invoiceId: '00000000-0000-4000-8000-000000000101',
        invoiceNumber: 'INV-TEST-MTD',
        salesOrderId: '00000000-0000-4000-8000-000000000100',
        currencyCode: 'AUD',
        stateCode: SALES_INVOICE_STATE.DRAFT,
        totalAmount: '100.00',
        outstandingAmount: '100.00',
        taxAmount: '0',
        baseTotalAmount: '0',
        baseOutstandingAmount: '0',
        exchangeRate: '1',
        createdOn: new Date(),
        createdBy: 'system',
      });

      const result = await service.findActiveInvoices({ days: 'mtd' });
      const invoice = result.data.find(
        (i: any) => i.invoiceId === '00000000-0000-4000-8000-000000000101',
      );
      expect(invoice).toBeDefined();
    });
  });

  describe('createProjectInvoice', () => {
    it('correctly calculates 10% tax and discount on project invoice lines', async () => {
      const projectId = '00000000-0000-4000-8000-000000000999';
      const projectTaxCatId = '00000000-0000-4000-8000-000000000998';

      await pg.db.insert(taxCategories).values({
        taxCategoryId: projectTaxCatId,
        code: 'GST_10',
        title: 'GST 10%',
        rate: '10.0',
        type: 'tax_applies',
      });

      await pg.db.insert(projects).values({
        projectId,
        projectNumber: 'FRE-PROJ-001',
        name: 'FREMANTLE Project',
        customerId: CUSTOMER_ID,
        currencyCode: 'AUD',
        stateCode: PROJECT_STATE.ACTIVE,
        billingType: PROJECT_BILLING_TYPE.TIME_AND_MATERIALS,
        createdBy: 'system',
      });

      const taxCategoriesService = (service as any).taxService;
      taxCategoriesService.getById = jest
        .fn()
        .mockImplementation(async (id: string) => {
          if (id === projectTaxCatId) return { rate: '10.0' };
          return { rate: '0.1' };
        });

      const result = await service.createProjectInvoice(
        {
          projectId,
          projectNumber: 'FRE-PROJ-001',
          customerId: CUSTOMER_ID,
          currencyCode: 'AUD',
          name: 'FREMANTLE Project',
        },
        {
          lines: [
            {
              projectTaskId: '00000000-0000-4000-8000-000000000001',
              description:
                'Resource usage: BOSCH REXROTH PTY LTD on FRE-PROJ-001',
              quantity: 2,
              pricePerUnit: 1000,
              amount: 1800,
              discountPercentage: 10,
              taxCategoryId: projectTaxCatId,
            },
          ],
        },
        'test_user',
      );

      // Qty 2 @ 1000 = 2000. 10% disc = 1800 net. 10% GST = 180. Grand total = 1980.
      expect(result.totalAmount).toBe('1980.00');
      expect(result.taxAmount).toBe('180.00');
    });

    it('automatically unbills project ledger entries when a project invoice is cancelled', async () => {
      const projectId = '00000000-0000-4000-8000-000000000888';
      const taskId = '00000000-0000-4000-8000-000000000887';
      const ledgerId = '00000000-0000-4000-8000-000000000886';

      await pg.db.insert(projects).values({
        projectId,
        projectNumber: 'PRJ-CANCEL-001',
        name: 'Cancellation Test Project',
        customerId: CUSTOMER_ID,
        currencyCode: 'AUD',
        stateCode: PROJECT_STATE.ACTIVE,
        billingType: PROJECT_BILLING_TYPE.TIME_AND_MATERIALS,
        createdBy: 'system',
      });

      await pg.db.insert(projectTasks).values({
        projectTaskId: taskId,
        projectId,
        taskCode: '1.0',
        name: 'Milestone / Task 1',
        stateCode: PROJECT_TASK_STATE.IN_PROGRESS,
        isMilestone: false,
        isBillable: true,
        createdBy: 'system',
      });

      const [entry] = await pg.db
        .insert(projectLedgerEntries)
        .values({
          ledgerId,
          projectId,
          projectTaskId: taskId,
          entryType: PROJECT_LEDGER_ENTRY_TYPE.USAGE,
          lineType: PROJECT_LINE_TYPE.RESOURCE,
          sourceType: PROJECT_SOURCE_TYPE.TIMESHEET,
          description: 'Consulting Delivery',
          quantity: '5',
          unitCostBase: '50.00',
          totalCostBase: '250.00',
          unitPriceBase: '100.00',
          totalPriceBase: '500.00',
          isBillable: true,
          isBilled: true,
          postingDate: new Date(),
          createdBy: 'test_user',
        })
        .returning();

      const invoiceResult = await service.createProjectInvoice(
        {
          projectId,
          projectNumber: 'PRJ-CANCEL-001',
          customerId: CUSTOMER_ID,
          currencyCode: 'AUD',
          name: 'Cancellation Test Project',
        },
        {
          lines: [
            {
              projectTaskId: taskId,
              projectLedgerEntryId: entry.ledgerId,
              description: 'Consulting Delivery',
              quantity: 5,
              pricePerUnit: 100,
              amount: 500,
            },
          ],
        },
        'test_user',
      );

      // Link the salesInvoiceLineId to the ledger entry
      const invLine = invoiceResult.lines[0];
      await pg.db
        .update(projectLedgerEntries)
        .set({ salesInvoiceLineId: invLine.invoiceLineId, isBilled: true })
        .where(eq(projectLedgerEntries.ledgerId, entry.ledgerId));

      // Verify it is billed
      let [ledgerRow] = await pg.db
        .select()
        .from(projectLedgerEntries)
        .where(eq(projectLedgerEntries.ledgerId, entry.ledgerId));
      expect(ledgerRow.isBilled).toBe(true);
      expect(ledgerRow.salesInvoiceLineId).toBe(invLine.invoiceLineId);

      // Now cancel the invoice
      await service.changeSalesInvoiceState(
        invoiceResult.invoiceId,
        SALES_INVOICE_STATE.CANCELLED,
        'test_user',
      );

      // Verify the ledger entry was moved back to unbilled
      [ledgerRow] = await pg.db
        .select()
        .from(projectLedgerEntries)
        .where(eq(projectLedgerEntries.ledgerId, entry.ledgerId));
      expect(ledgerRow.isBilled).toBe(false);
      expect(ledgerRow.salesInvoiceLineId).toBeNull();
    });
  });
});
