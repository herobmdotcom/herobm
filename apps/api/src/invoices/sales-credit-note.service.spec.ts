import { Test, TestingModule } from '@nestjs/testing';
import { SalesCreditNoteService } from './sales-credit-note.service';
import { GlService } from '../gl/gl.service';
import { TaxCategoriesService } from '../tax/tax-categories.service';
import { AppConfigService } from '../settings/app-config.service';
import { OrganizationService } from '../settings/organization.service';
import { EnrichmentService } from '../enrichment/enrichment.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { setupPgliteSuite } from '../test-utils/pglite-suite';
import {
  salesOrders,
  salesOrderLineItems,
  salesOrderReturns,
  salesOrderReturnLines,
  salesCreditNotes,
  salesCreditNoteLines,
  salesOrderShipments,
  salesOrderShipmentLines,
  customers,
  products,
  locations,
  actors,
  glAccounts,
  glSettings,
  uomDictionary,
  taxCategories,
  salesInvoices,
  salesInvoiceLines,
} from '@herobm/db-schema';
import { eq } from 'drizzle-orm';
import {
  SALES_ORDER_STATE,
  RETURN_STATE,
  RETURN_RESOLUTION,
  CUSTOMER_STATE,
  PRODUCT_STATE,
  SHIPMENT_STATE,
  PUTAWAY_STATUS,
  SALES_INVOICE_STATE,
} from '@herobm/shared';

describe('SalesCreditNoteService', () => {
  const pg = setupPgliteSuite({ skipSeeds: true });
  let service: SalesCreditNoteService;

  let mockGlService: any;
  let mockTaxService: any;
  let mockAppConfigService: any;
  let mockOrgService: any;
  let mockEnrichmentService: any;

  const CUSTOMER_ID = '00000000-0000-4000-8000-000000000001';
  const ACTOR_ID = '00000000-0000-4000-8000-000000000002';
  const ORDER_ID = '00000000-0000-4000-8000-000000000003';
  const PRODUCT_1_ID = '00000000-0000-4000-8000-00000000000a';
  const PRODUCT_2_ID = '00000000-0000-4000-8000-00000000000b';
  const TAX_CAT_ID = '00000000-0000-4000-8000-000000000007';
  const LOCATION_ID = '00000000-0000-4000-8000-00000000000f';

  const AR_ACCT_ID = '00000000-0000-4000-8000-0000000000c1';
  const REV_ACCT_ID = '00000000-0000-4000-8000-0000000000c2';
  const TAX_ACCT_ID = '00000000-0000-4000-8000-0000000000c3';
  const FEE_ACCT_ID = '00000000-0000-4000-8000-0000000000c4';

  beforeEach(async () => {
    // Truncate tables
    await pg.client.exec(`
      TRUNCATE herobm_core.sales_credit_note_lines CASCADE;
      TRUNCATE herobm_core.sales_credit_notes CASCADE;
      TRUNCATE herobm_core.sales_order_return_lines CASCADE;
      TRUNCATE herobm_core.sales_order_returns CASCADE;
      TRUNCATE herobm_core.sales_order_shipment_lines CASCADE;
      TRUNCATE herobm_core.sales_order_shipments CASCADE;
      TRUNCATE herobm_core.sales_invoice_lines CASCADE;
      TRUNCATE herobm_core.sales_invoices CASCADE;
      TRUNCATE herobm_core.sales_order_lines CASCADE;
      TRUNCATE herobm_core.sales_orders CASCADE;
      TRUNCATE herobm_core.customers CASCADE;
      TRUNCATE herobm_core.products CASCADE;
      TRUNCATE herobm_core.gl_accounts CASCADE;
      TRUNCATE herobm_core.gl_settings CASCADE;
      TRUNCATE herobm_core.tax_categories CASCADE;
      TRUNCATE herobm_core.locations CASCADE;
      TRUNCATE herobm_core.actors CASCADE;
      TRUNCATE herobm_core.uom_dictionary CASCADE;
    `);

    // Seed UOM, Tax, Location, Actor, Customer, Products
    await pg.db.insert(uomDictionary).values({
      uomCode: 'EA',
      description: 'Each',
    });

    await pg.db.insert(taxCategories).values({
      taxCategoryId: TAX_CAT_ID,
      code: 'GST',
      title: 'GST Standard',
      rate: '10',
      type: 'tax_applies',
    });

    await pg.db.insert(locations).values({
      locationId: LOCATION_ID,
      code: 'MAIN',
      name: 'Main Warehouse',
      source: 'app',
      createdBy: 'system',
    });

    await pg.db.insert(actors).values({
      actorId: ACTOR_ID,
      name: 'Test Customer Inc',
      isTaxRegistered: true,
    });

    await pg.db.insert(customers).values({
      customerId: CUSTOMER_ID,
      actorId: ACTOR_ID,
      customerNumber: 'CUST-001',
      currencyCode: 'AUD',
      stateCode: CUSTOMER_STATE.ACTIVE,
      source: 'app',
      createdBy: 'system',
    });

    await pg.db.insert(products).values([
      {
        productId: PRODUCT_1_ID,
        productNumber: 'P001',
        name: 'Widget Alpha',
        baseUom: 'EA',
        productType: 'inventory',
        stateCode: PRODUCT_STATE.ACTIVE,
        source: 'app',
        structureType: 'standard',
        standardCost: '50.00',
      },
      {
        productId: PRODUCT_2_ID,
        productNumber: 'P002',
        name: 'Widget Beta',
        baseUom: 'EA',
        productType: 'inventory',
        stateCode: PRODUCT_STATE.ACTIVE,
        source: 'app',
        structureType: 'standard',
        standardCost: '75.00',
      },
    ]);

    // Seed GL Accounts
    await pg.db.insert(glAccounts).values([
      {
        glAccountId: AR_ACCT_ID,
        accountCode: '11000',
        name: 'Accounts Receivable',
        accountType: 'asset',
        isGroup: false,
        isSystem: false,
        isBankAccount: false,
        currencyCode: 'AUD',
        isActive: true,
      },
      {
        glAccountId: REV_ACCT_ID,
        accountCode: '41000',
        name: 'Sales Revenue',
        accountType: 'revenue',
        isGroup: false,
        isSystem: false,
        isBankAccount: false,
        currencyCode: 'AUD',
        isActive: true,
      },
      {
        glAccountId: TAX_ACCT_ID,
        accountCode: '22000',
        name: 'GST Payable',
        accountType: 'liability',
        isGroup: false,
        isSystem: false,
        isBankAccount: false,
        currencyCode: 'AUD',
        isActive: true,
      },
      {
        glAccountId: FEE_ACCT_ID,
        accountCode: '42000',
        name: 'Restocking Fee Income',
        accountType: 'revenue',
        isGroup: false,
        isSystem: false,
        isBankAccount: false,
        currencyCode: 'AUD',
        isActive: true,
      },
    ]);

    mockGlService = {
      getSettings: jest.fn().mockResolvedValue({
        defaultArAccountId: AR_ACCT_ID,
        defaultRevenueAccountId: REV_ACCT_ID,
        defaultSalesTaxAccountId: TAX_ACCT_ID,
        defaultFeeRevenueAccountId: FEE_ACCT_ID,
      }),
      postJournalEntry: jest.fn().mockResolvedValue({
        journalEntryId: 'je-cn-001',
        entryNumber: 'JE-20260813-0001',
      }),
    };

    mockTaxService = {
      getById: jest.fn().mockResolvedValue({
        taxCategoryId: TAX_CAT_ID,
        code: 'GST',
        title: 'GST Standard',
        rate: '10',
      }),
    };

    mockAppConfigService = {
      defaultArAccountId: () => AR_ACCT_ID,
      defaultRevenueAccountId: () => REV_ACCT_ID,
      defaultSalesTaxAccountId: () => TAX_ACCT_ID,
      defaultFeeRevenueAccountId: () => FEE_ACCT_ID,
      defaultCostCenterId: () => undefined,
      defaultActivityId: () => undefined,
      homeCurrency: () => 'AUD',
    };

    mockOrgService = {
      getOrganizationDetails: jest.fn().mockResolvedValue({
        companyName: 'HeroBM HQ',
      }),
    };

    mockEnrichmentService = {
      resolveAddress: jest.fn().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalesCreditNoteService,
        { provide: DRIZZLE, useValue: pg.db },
        { provide: GlService, useValue: mockGlService },
        { provide: TaxCategoriesService, useValue: mockTaxService },
        { provide: AppConfigService, useValue: mockAppConfigService },
        { provide: OrganizationService, useValue: mockOrgService },
        { provide: EnrichmentService, useValue: mockEnrichmentService },
      ],
    }).compile();

    service = module.get<SalesCreditNoteService>(SalesCreditNoteService);
  });

  async function createOrderWithShipmentAndInvoice(options?: {
    line1Qty?: number;
    line1Price?: number;
    line1Disc?: number;
    line2Qty?: number;
    line2Price?: number;
    line2Disc?: number;
  }) {
    const l1Qty = options?.line1Qty ?? 10;
    const l1Price = options?.line1Price ?? 100;
    const l1Disc = options?.line1Disc ?? 0;
    const l2Qty = options?.line2Qty ?? 5;
    const l2Price = options?.line2Price ?? 200;
    const l2Disc = options?.line2Disc ?? 0;

    // Create Order
    await pg.db.insert(salesOrders).values({
      salesOrderId: ORDER_ID,
      orderNumber: 'SO-20260813-001',
      customerId: CUSTOMER_ID,
      fulfillmentLocationId: LOCATION_ID,
      currencyCode: 'AUD',
      exchangeRate: '1',
      baseTotalAmount: '0',
      stateCode: SALES_ORDER_STATE.INVOICED,
      discrepanciesAcknowledged: false,
      source: 'app',
      createdBy: 'test-admin',
    });

    const line1Id = '00000000-0000-4000-8000-0000000000e1';
    const line2Id = '00000000-0000-4000-8000-0000000000e2';

    await pg.db.insert(salesOrderLineItems).values([
      {
        salesOrderLineId: line1Id,
        salesOrderId: ORDER_ID,
        lineNumber: 1,
        productId: PRODUCT_1_ID,
        productDescription: 'Product 1',
        quantity: String(l1Qty),
        pricePerUnit: String(l1Price),
        discountPercentage: String(l1Disc),
        amount: String(l1Qty * l1Price * (1 - l1Disc / 100)),
        fulfillmentLocationId: LOCATION_ID,
        taxCategoryId: TAX_CAT_ID,
      },
      {
        salesOrderLineId: line2Id,
        salesOrderId: ORDER_ID,
        lineNumber: 2,
        productId: PRODUCT_2_ID,
        productDescription: 'Product 2',
        quantity: String(l2Qty),
        pricePerUnit: String(l2Price),
        discountPercentage: String(l2Disc),
        amount: String(l2Qty * l2Price * (1 - l2Disc / 100)),
        fulfillmentLocationId: LOCATION_ID,
        taxCategoryId: TAX_CAT_ID,
      },
    ]);

    // Create Shipment (marking items shipped)
    const shipmentId = '00000000-0000-4000-8000-0000000000f1';
    await pg.db.insert(salesOrderShipments).values({
      shipmentId,
      shipmentNumber: 'SHP-20260813-001',
      salesOrderId: ORDER_ID,
      fulfillmentLocationId: LOCATION_ID,
      stateCode: SHIPMENT_STATE.DISPATCHED,
      createdBy: 'test-admin',
    });

    await pg.db.insert(salesOrderShipmentLines).values([
      {
        shipmentLineId: '00000000-0000-4000-8000-0000000000c1',
        shipmentId,
        salesOrderLineId: line1Id,
        quantityShipped: String(l1Qty),
        createdBy: 'test-admin',
      },
      {
        shipmentLineId: '00000000-0000-4000-8000-0000000000c2',
        shipmentId,
        salesOrderLineId: line2Id,
        quantityShipped: String(l2Qty),
        createdBy: 'test-admin',
      },
    ] as any);

    // Create Invoice (marking items invoiced)
    const invoiceId = '00000000-0000-4000-8000-000000000011';
    await pg.db.insert(salesInvoices).values({
      invoiceId,
      invoiceNumber: 'INV-20260813-001',
      salesOrderId: ORDER_ID,
      customerId: CUSTOMER_ID,
      currencyCode: 'AUD',
      exchangeRate: '1',
      stateCode: SALES_INVOICE_STATE.INVOICED,
      taxAmount: '200.00',
      totalAmount: '2200.00',
      outstandingAmount: '2200.00',
      baseTotalAmount: '0',
      baseOutstandingAmount: '0',
      createdBy: 'test-admin',
    });

    await pg.db.insert(salesInvoiceLines).values([
      {
        invoiceLineId: '00000000-0000-4000-8000-0000000000d1',
        invoiceId,
        salesOrderLineId: line1Id,
        quantityInvoiced: String(l1Qty),
        pricePerUnit: String(l1Price),
        amount: String(l1Qty * l1Price * (1 - l1Disc / 100)),
      },
      {
        invoiceLineId: '00000000-0000-4000-8000-0000000000d2',
        invoiceId,
        salesOrderLineId: line2Id,
        quantityInvoiced: String(l2Qty),
        pricePerUnit: String(l2Price),
        amount: String(l2Qty * l2Price * (1 - l2Disc / 100)),
      },
    ]);

    return { line1Id, line2Id, invoiceId, shipmentId };
  }

  describe('createCreditNote from return', () => {
    it('creates credit note for a standard return with REFUND resolution', async () => {
      const { line1Id } = await createOrderWithShipmentAndInvoice();

      const returnId = '00000000-0000-4000-8000-000000000021';
      await pg.db.insert(salesOrderReturns).values({
        returnId,
        returnNumber: 'RET-20260813-001',
        salesOrderId: ORDER_ID,
        locationId: LOCATION_ID,
        stateCode: RETURN_STATE.RECEIVED,
        createdBy: 'test-admin',
      });

      await pg.db.insert(salesOrderReturnLines).values({
        returnLineId: '00000000-0000-4000-8000-000000000031',
        returnId,
        salesOrderLineId: line1Id,
        quantityReturned: '3', // returning 3 @ $100
        resolution: RETURN_RESOLUTION.REFUND,
        returnFee: '15.00',
        putawayStatus: PUTAWAY_STATUS.AWAITING_MATCHING,
      });

      const cn = await service.createCreditNote(
        { returnId, lines: [] },
        'test-admin',
      );

      expect(cn).toBeDefined();
      expect(cn?.creditNoteNumber).toMatch(/^CN-\d{8}-\d{4}$/);
      expect(cn?.salesOrderId).toBe(ORDER_ID);
      expect(cn?.returnId).toBe(returnId);
      expect(cn?.totalAmount).toBe('300.00'); // 3 × $100
      expect(cn?.taxAmount).toBe('30.00'); // 10% GST on 300
      expect(cn?.feeAmount).toBe('15.00');
      expect(cn?.outstandingAmount).toBe('315.00'); // 300 + 30 - 15 = 315.00

      // Check lines
      const cnLines = await pg.db
        .select()
        .from(salesCreditNoteLines)
        .where(eq(salesCreditNoteLines.creditNoteId, cn!.creditNoteId));

      expect(cnLines).toHaveLength(1);
      expect(cnLines[0].salesOrderLineId).toBe(line1Id);
      expect(cnLines[0].quantityCredited).toBe('3');
      expect(cnLines[0].pricePerUnit).toBe('100');
      expect(cnLines[0].amount).toBe('300.00');
      expect(cnLines[0].taxAmount).toBe('30.00');

      // Verify GL journal entry was posted
      expect(mockGlService.postJournalEntry).toHaveBeenCalledTimes(1);
      const glCall = mockGlService.postJournalEntry.mock.calls[0];
      const lines = glCall[0];
      // 1 line AR Credit ($315), Revenue Debit ($300), Tax Debit ($30), Fee Credit ($15)
      const arLine = lines.find((l: any) => l.accountCode === '11000');
      const revLine = lines.find((l: any) => l.accountCode === '41000');
      const taxLine = lines.find((l: any) => l.accountCode === '22000');
      const feeLine = lines.find((l: any) => l.accountCode === '42000');

      expect(arLine.credit).toBe(315);
      expect(revLine.debit).toBe(300);
      expect(taxLine.debit).toBe(30);
      expect(feeLine.credit).toBe(15);
    });

    it('creates credit note for mixed REFUND and REPLACE resolutions', async () => {
      const { line1Id, line2Id } = await createOrderWithShipmentAndInvoice();

      const returnId = '00000000-0000-4000-8000-000000000022';
      await pg.db.insert(salesOrderReturns).values({
        returnId,
        returnNumber: 'RET-20260813-002',
        salesOrderId: ORDER_ID,
        locationId: LOCATION_ID,
        stateCode: RETURN_STATE.RECEIVED,
        createdBy: 'test-admin',
      });

      // Line 1: Refund 2 units @ $100, $5 fee
      // Line 2: Replace 1 unit @ $200, $10 fee
      await pg.db.insert(salesOrderReturnLines).values([
        {
          returnLineId: '00000000-0000-4000-8000-000000000031',
          returnId,
          salesOrderLineId: line1Id,
          quantityReturned: '2',
          resolution: RETURN_RESOLUTION.REFUND,
          returnFee: '5.00',
          putawayStatus: PUTAWAY_STATUS.AWAITING_MATCHING,
        },
        {
          returnLineId: '00000000-0000-4000-8000-000000000032',
          returnId,
          salesOrderLineId: line2Id,
          quantityReturned: '1',
          resolution: RETURN_RESOLUTION.REPLACE,
          returnFee: '10.00',
          putawayStatus: PUTAWAY_STATUS.AWAITING_MATCHING,
        },
      ]);

      const cn = await service.createCreditNote(
        { returnId, lines: [] },
        'test-admin',
      );

      expect(cn).toBeDefined();
      expect(cn?.totalAmount).toBe('200.00'); // only refund line (2 × 100)
      expect(cn?.taxAmount).toBe('20.00'); // 10% GST on 200
      expect(cn?.feeAmount).toBe('15.00'); // $5 + $10 return fees
      expect(cn?.outstandingAmount).toBe('205.00'); // 200 + 20 - 15 = 205.00

      const cnLines = await pg.db
        .select()
        .from(salesCreditNoteLines)
        .where(eq(salesCreditNoteLines.creditNoteId, cn!.creditNoteId));

      // Replace line had creditableQty = 0, so only line 1 has credited quantity > 0
      expect(
        cnLines.filter((l) => Number(l.quantityCredited) > 0),
      ).toHaveLength(1);
      expect(cnLines[0].salesOrderLineId).toBe(line1Id);
      expect(cnLines[0].quantityCredited).toBe('2');
    });

    it('correctly applies line discounts on returns', async () => {
      // Line 1 has 20% discount (100 * 0.8 = $80 net price)
      const { line1Id } = await createOrderWithShipmentAndInvoice({
        line1Qty: 5,
        line1Price: 100,
        line1Disc: 20,
      });

      const returnId = '00000000-0000-4000-8000-000000000023';
      await pg.db.insert(salesOrderReturns).values({
        returnId,
        returnNumber: 'RET-20260813-003',
        salesOrderId: ORDER_ID,
        locationId: LOCATION_ID,
        stateCode: RETURN_STATE.RECEIVED,
        createdBy: 'test-admin',
      });

      await pg.db.insert(salesOrderReturnLines).values({
        returnLineId: '00000000-0000-4000-8000-000000000031',
        returnId,
        salesOrderLineId: line1Id,
        quantityReturned: '2', // 2 units @ $80 net = $160 subtotal
        resolution: RETURN_RESOLUTION.REFUND,
        returnFee: '0.00',
        putawayStatus: PUTAWAY_STATUS.AWAITING_MATCHING,
      });

      const cn = await service.createCreditNote(
        { returnId, lines: [] },
        'test-admin',
      );

      expect(cn).toBeDefined();
      expect(cn?.totalAmount).toBe('160.00'); // 2 × 80.00
      expect(cn?.taxAmount).toBe('16.00'); // 10% of 160
      expect(cn?.outstandingAmount).toBe('176.00'); // 160 + 16
    });

    it('enforces sequential credit limits across multiple returns for same order', async () => {
      const { line1Id } = await createOrderWithShipmentAndInvoice({
        line1Qty: 10,
        line1Price: 50,
      });

      // Return #1: 6 items refunded
      const return1Id = '00000000-0000-4000-8000-000000000024';
      await pg.db.insert(salesOrderReturns).values({
        returnId: return1Id,
        returnNumber: 'RET-20260813-004',
        salesOrderId: ORDER_ID,
        locationId: LOCATION_ID,
        stateCode: RETURN_STATE.RECEIVED,
        createdBy: 'test-admin',
      });
      await pg.db.insert(salesOrderReturnLines).values({
        returnLineId: '00000000-0000-4000-8000-000000000034',
        returnId: return1Id,
        salesOrderLineId: line1Id,
        quantityReturned: '6',
        resolution: RETURN_RESOLUTION.REFUND,
        putawayStatus: PUTAWAY_STATUS.AWAITING_MATCHING,
      });

      const cn1 = await service.createCreditNote(
        { returnId: return1Id, lines: [] },
        'test-admin',
      );
      expect(cn1?.totalAmount).toBe('300.00'); // 6 × 50

      // Return #2: Attempting to return all remaining items (quantityReturned = 10 total across returns)
      const return2Id = '00000000-0000-4000-8000-000000000025';
      await pg.db.insert(salesOrderReturns).values({
        returnId: return2Id,
        returnNumber: 'RET-20260813-005',
        salesOrderId: ORDER_ID,
        locationId: LOCATION_ID,
        stateCode: RETURN_STATE.RECEIVED,
        createdBy: 'test-admin',
      });
      await pg.db.insert(salesOrderReturnLines).values({
        returnLineId: '00000000-0000-4000-8000-000000000035',
        returnId: return2Id,
        salesOrderLineId: line1Id,
        quantityReturned: '10', // 10 total requested returned (6 previously credited -> 4 remaining)
        resolution: RETURN_RESOLUTION.REFUND,
        putawayStatus: PUTAWAY_STATUS.AWAITING_MATCHING,
      });

      const cn2 = await service.createCreditNote(
        { returnId: return2Id, lines: [] },
        'test-admin',
      );

      expect(cn2?.totalAmount).toBe('200.00'); // capped at remaining 4 × 50 = 200
    });
  });

  describe('createAdhocCreditNote', () => {
    it('creates ad-hoc credit note directly for customer with lines, discounts, taxes, and GL posting', async () => {
      const adhoc = await service.createCreditNote(
        {
          customerId: CUSTOMER_ID,
          notes: 'Goodwill gesture',
          lines: [
            {
              amount: 180,
              accountId: REV_ACCT_ID,
              taxCategoryId: TAX_CAT_ID,
              description: 'Goodwill refund for Widget Alpha',
            },
          ],
        },
        'test-admin',
      );

      expect(adhoc).toBeDefined();
      expect(adhoc?.creditNoteNumber).toMatch(/^CN-\d{8}-\d{4}$/);
      expect(adhoc?.customerId).toBe(CUSTOMER_ID);
      expect(adhoc?.totalAmount).toBe('180.00');

      const lines = await pg.db
        .select()
        .from(salesCreditNoteLines)
        .where(eq(salesCreditNoteLines.creditNoteId, adhoc!.creditNoteId));

      expect(lines).toHaveLength(1);
      expect(lines[0].amount).toBe('180.00');

      expect(mockGlService.postJournalEntry).toHaveBeenCalledTimes(1);
    });
  });
});
