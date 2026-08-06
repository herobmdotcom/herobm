import { Test, TestingModule } from '@nestjs/testing';
import { PurchaseInvoiceCoreService } from './purchase-invoice-core.service';
import { PurchaseInvoiceDraftService } from './purchase-invoice-draft.service';
import { PurchaseInvoicePostingService } from './purchase-invoice-posting.service';
import { GlService } from '../gl/gl.service';
import { TaxCategoriesService } from '../tax/tax-categories.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { AppConfigService } from '../settings/app-config.service';
import { setupPgliteSuite } from '../test-utils/pglite-suite';
import {
  purchaseOrders,
  purchaseOrderLineItems,
  suppliers,
  taxCategories,
  products,
  locations,
  uomDictionary,
  purchaseInvoices,
  purchaseInvoiceLines,
  goodsReceived,
  goodsReceivedLines,
  purchaseInvoiceReceipts,
  glAccounts,
  actors,
} from '@herobm/db-schema';
import { PgliteDatabase } from 'drizzle-orm/pglite';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import {
  PURCHASE_ORDER_STATE,
  PURCHASE_INVOICE_STATE,
  MATCH_STATUS,
  PUTAWAY_STATUS,
  CUSTOMER_STATE,
  SUPPLIER_STATE,
  GOODS_RECEIVED_STATE,
  PRODUCT_STATE,
} from '@herobm/shared';

/**
 * Local wrapper that proxies to the 3 sub-services so existing tests
 * continue to work without rewriting every `service.xxx()` call.
 */
class PurchaseInvoiceService {
  core: PurchaseInvoiceCoreService;
  draft: PurchaseInvoiceDraftService;
  posting: PurchaseInvoicePostingService;

  constructor(
    core: PurchaseInvoiceCoreService,
    draft: PurchaseInvoiceDraftService,
    posting: PurchaseInvoicePostingService,
  ) {
    this.core = core;
    this.draft = draft;
    this.posting = posting;
  }

  findOne(...args: any[]) {
    return this.core.findOne(...(args as [any, any]));
  }
  findByOrder(...args: any[]) {
    return this.core.findByOrder(...(args as [any]));
  }
  findActiveInvoices(...args: any[]) {
    return this.core.findActiveInvoices(...(args as [any]));
  }
  createDraftInvoice(...args: any[]) {
    return this.draft.createDraftInvoice(...(args as [any, any]));
  }
  updateInvoice(...args: any[]) {
    return this.draft.updateInvoice(...(args as [any, any, any]));
  }
  updateLine(...args: any[]) {
    return this.draft.updateLine(...(args as [any, any, any, any]));
  }
  removeLine(...args: any[]) {
    return this.draft.removeLine(...(args as [any, any, any]));
  }
  addLine(...args: any[]) {
    return this.draft.addLine(...(args as [any, any, any]));
  }
  changePurchaseInvoiceState(...args: any[]) {
    return this.draft.changePurchaseInvoiceState(
      ...(args as [any, any, any, any, any]),
    );
  }
  adminMarkPaid(...args: any[]) {
    return this.draft.adminMarkPaid(...(args as [any, any]));
  }
  postInvoice(...args: any[]) {
    return this.posting.postInvoice(...(args as [any, any]));
  }
  resolveInvoiceLine(...args: any[]) {
    return this.posting.resolveInvoiceLine(...(args as [any, any, any]));
  }
  autoMatchPurchaseOrder(...args: any[]) {
    return this.posting.autoMatchPurchaseOrder(...(args as [any, any, any]));
  }
  unresolveInvoiceLine(...args: any[]) {
    return this.posting.unresolveInvoiceLine(...(args as [any, any]));
  }
}

describe('PurchaseInvoiceService', () => {
  const pg = setupPgliteSuite({ skipSeeds: true });
  let service: PurchaseInvoiceService;
  let mockGlService: Partial<Record<keyof GlService, jest.Mock>>;

  let mockAppConfig: any;

  const VENDOR_ID = '00000000-0000-4000-8000-000000000001';
  const PO_ID = '00000000-0000-4000-8000-000000000002';
  const PRODUCT_ID = '00000000-0000-4000-8000-00000000000a';
  const TAX_CAT_ID = '00000000-0000-4000-8000-000000000007';
  const LOCATION_ID = '00000000-0000-4000-8000-00000000000f';

  beforeEach(async () => {
    // Seed static data
    await pg.db.insert(uomDictionary).values({
      uomCode: 'EA',
      description: 'Each',
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

    const actorId = '00000000-0000-4000-8000-000000000003';
    await pg.db.insert(actors).values({
      actorId,
      name: 'Steel Co',
      headquartersAddressLine1: 'AU',
      isTaxRegistered: false,
    });

    await pg.db.insert(suppliers).values({
      vendorId: VENDOR_ID,
      actorId,
      vendorNumber: 'V001',
      currencyCode: 'AUD',
      stateCode: SUPPLIER_STATE.ACTIVE,
      source: 'app',
      isPurchasingBlocked: false,
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
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    mockGlService = {
      getSettings: jest.fn().mockResolvedValue({
        defaultApAccountId: 'gl-ap',
        defaultPurchaseTaxAccountId: 'gl-tax',
        defaultGrniAccountId: 'gl-grni',
        defaultExpenseAccountId: 'gl-expense',
      }),
      postJournalEntry: jest
        .fn()
        .mockResolvedValue({ journalEntryId: 'je-001' }),
    };

    mockAppConfig = {
      inventoryAccountingMode: jest.fn().mockReturnValue('perpetual'),
      defaultCostCenterId: jest
        .fn()
        .mockReturnValue('00000000-0000-4000-8000-0000000000c1'),
      defaultActivityId: jest
        .fn()
        .mockReturnValue('00000000-0000-4000-8000-0000000000a1'),
      expenseRoutingPrecedence: jest.fn().mockReturnValue('supplier_first'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchaseInvoiceCoreService,
        PurchaseInvoiceDraftService,
        PurchaseInvoicePostingService,
        { provide: DRIZZLE, useValue: pg.db },
        { provide: GlService, useValue: mockGlService },
        {
          provide: TaxCategoriesService,
          useValue: {
            getById: jest.fn().mockResolvedValue({ rate: '0.1' }),
            getByCode: jest.fn().mockResolvedValue({ rate: '0.1' }),
          },
        },
        {
          provide: AppConfigService,
          useValue: mockAppConfig,
        },
      ],
    }).compile();

    const core = module.get<PurchaseInvoiceCoreService>(
      PurchaseInvoiceCoreService,
    );
    const draft = module.get<PurchaseInvoiceDraftService>(
      PurchaseInvoiceDraftService,
    );
    const posting = module.get<PurchaseInvoicePostingService>(
      PurchaseInvoicePostingService,
    );
    service = new PurchaseInvoiceService(core, draft, posting);

    // Clean transactional data
    await pg.db.delete(purchaseOrderLineItems);
    await pg.db.delete(purchaseOrders);
  });

  async function seedPO(stateCode: string = PURCHASE_ORDER_STATE.RECEIVED) {
    await pg.db.insert(purchaseOrders).values({
      purchaseOrderId: PO_ID,
      orderNumber: 'PO-1',
      vendorId: VENDOR_ID,

      stateCode: stateCode as any,
      currencyCode: 'AUD',
      deliveryLocationId: LOCATION_ID,
      baseTotalAmount: '0',
      exchangeRate: '1',
      createdBy: 'system',
    });

    await pg.db.insert(purchaseOrderLineItems).values({
      purchaseOrderLineId: '00000000-0000-4000-8000-000000000003',
      purchaseOrderId: PO_ID,
      lineNumber: 1,
      productId: PRODUCT_ID,
      taxCategoryId: TAX_CAT_ID,
      quantity: '10',
      quantityReceived: '10',
      pricePerUnit: '15.00',
      tax: '1.50',
      amount: '150.00',
      discountPercentage: '0',
    });
  }

  describe('findOne', () => {
    it('should throw NotFoundException for unknown bill', async () => {
      await expect(
        service.findOne('00000000-0000-4000-8000-000000000888'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByOrder', () => {
    it('should return empty array when no bills exist', async () => {
      const result = await service.findByOrder(PO_ID);
      expect(result).toEqual([]);
    });
  });

  describe('postInvoice', () => {
    it('should post invoice with PPV when invoice cost differs from receipt cost', async () => {
      mockGlService.getSettings = jest.fn().mockResolvedValue({
        defaultApAccountId: '00000000-0000-4000-8000-0000000000a1',
        defaultPurchaseTaxAccountId: '00000000-0000-4000-8000-0000000000a2',
        defaultGrniAccountId: '00000000-0000-4000-8000-0000000000a3',
        defaultExpenseAccountId: '00000000-0000-4000-8000-0000000000a4',
        defaultPpvAccountId: '00000000-0000-4000-8000-0000000000a5',
      });

      const invoiceId = '00000000-0000-4000-8000-000000000022';
      const invoiceLineId = '00000000-0000-4000-8000-000000000033';
      const goodsReceivedId = '00000000-0000-4000-8000-000000000044';
      const goodsReceivedLineId = '00000000-0000-4000-8000-000000000055';

      await seedPO();

      // Schemas are statically imported

      await pg.db.insert(glAccounts).values([
        {
          glAccountId: '00000000-0000-4000-8000-0000000000a1',
          accountCode: 'gl-ap',
          name: 'AP',
          accountType: 'liability',
          isGroup: false,
          isSystem: false,
          isBankAccount: false,
          isActive: true,
          currencyCode: 'AUD',
        },
        {
          glAccountId: '00000000-0000-4000-8000-0000000000a2',
          accountCode: 'gl-tax',
          name: 'Tax',
          accountType: 'liability',
          isGroup: false,
          isSystem: false,
          isBankAccount: false,
          isActive: true,
          currencyCode: 'AUD',
        },
        {
          glAccountId: '00000000-0000-4000-8000-0000000000a3',
          accountCode: 'gl-grni',
          name: 'GRNI',
          accountType: 'liability',
          isGroup: false,
          isSystem: false,
          isBankAccount: false,
          isActive: true,
          currencyCode: 'AUD',
        },
        {
          glAccountId: '00000000-0000-4000-8000-0000000000a4',
          accountCode: 'gl-expense',
          name: 'Expense',
          accountType: 'expense',
          isGroup: false,
          isSystem: false,
          isBankAccount: false,
          isActive: true,
          currencyCode: 'AUD',
        },
        {
          glAccountId: '00000000-0000-4000-8000-0000000000a5',
          accountCode: 'gl-ppv',
          name: 'PPV',
          accountType: 'expense',
          isGroup: false,
          isSystem: false,
          isBankAccount: false,
          isActive: true,
          currencyCode: 'AUD',
        },
      ]);

      // Create Goods Received
      await pg.db.insert(goodsReceived).values({
        goodsReceivedId,
        receiptNumber: 'REC-123',
        locationId: LOCATION_ID,
        vendorId: VENDOR_ID,
        packingSlipNumber: 'PACK-123',
        stateCode: GOODS_RECEIVED_STATE.RECEIVED,
        createdBy: 'system',
      });

      await pg.db.insert(goodsReceivedLines).values({
        goodsReceivedLineId,
        goodsReceivedId,
        productId: PRODUCT_ID,
        quantityReceived: '10',
        unitCost: '10.00', // Received at $10
        purchaseOrderLineId: '00000000-0000-4000-8000-000000000003',
        matchStatus: MATCH_STATUS.MATCHED,
        putawayStatus: PUTAWAY_STATUS.PENDING_PUTAWAY,
      });

      // Create Invoice
      await pg.db.insert(purchaseInvoices).values({
        invoiceId,
        invoiceNumber: 'INV-123',
        vendorId: VENDOR_ID,
        purchaseOrderId: PO_ID,
        totalAmount: '120.00',
        taxAmount: '0.00',
        currencyCode: 'AUD',
        stateCode: PURCHASE_INVOICE_STATE.DRAFT,
        outstandingAmount: '0',
        baseTotalAmount: '0',
        baseOutstandingAmount: '0',
        exchangeRate: '1',
        createdBy: 'system',
      });

      await pg.db.insert(purchaseInvoiceLines).values({
        invoiceLineId,
        invoiceId,
        productId: PRODUCT_ID,
        purchaseOrderLineId: '00000000-0000-4000-8000-000000000003',
        quantityInvoiced: '10',
        pricePerUnit: '12.00',
        amount: '120.00', // Invoiced at $12
        matchStatus: MATCH_STATUS.MATCHED,
      });

      await pg.db.insert(purchaseInvoiceReceipts).values({
        invoiceLineId,
        goodsReceivedLineId,
        quantityBilled: '10',
      });

      await service.postInvoice(invoiceId, 'admin');

      expect(mockGlService.postJournalEntry).toHaveBeenCalledTimes(1);
      const journalPayload = mockGlService.postJournalEntry!.mock.calls[0][0];

      // Expect AP to be credited 120
      const apLine = journalPayload.find((l: any) => l.accountCode === 'gl-ap');
      expect(apLine).toBeDefined();
      expect(apLine.credit).toBe(120);

      // Expect GRNI to be debited 100
      const grniLine = journalPayload.find(
        (l: any) => l.accountCode === 'gl-grni',
      );
      expect(grniLine).toBeDefined();
      expect(grniLine.debit).toBe(100);

      // Expect PPV to be debited 20
      const ppvLine = journalPayload.find(
        (l: any) => l.accountCode === 'gl-ppv',
      );
      expect(ppvLine).toBeDefined();
      expect(ppvLine.debit).toBe(20);
    });
    it('should post invoice with FX Variance and PPV when invoice cost and exchange rate differ from receipt', async () => {
      mockGlService.getSettings = jest.fn().mockResolvedValue({
        defaultApAccountId: '00000000-0000-4000-8000-0000000000a1',
        defaultPurchaseTaxAccountId: '00000000-0000-4000-8000-0000000000a2',
        defaultGrniAccountId: '00000000-0000-4000-8000-0000000000a3',
        defaultExpenseAccountId: '00000000-0000-4000-8000-0000000000a4',
        defaultPpvAccountId: '00000000-0000-4000-8000-0000000000a5',
        realisedFxGainAccountId: '00000000-0000-4000-8000-0000000000a6',
        realisedFxLossAccountId: '00000000-0000-4000-8000-0000000000a7',
      });

      const invoiceId = randomUUID();
      const invoiceLineId = randomUUID();
      const goodsReceivedId = randomUUID();
      const goodsReceivedLineId = randomUUID();
      const soId = randomUUID();

      await pg.db
        .insert(glAccounts)
        .values([
          {
            glAccountId: '00000000-0000-4000-8000-0000000000a1',
            accountCode: 'gl-ap',
            name: 'AP',
            accountType: 'liability',
            isGroup: false,
            isSystem: false,
            isBankAccount: false,
            isActive: true,
            currencyCode: 'AUD',
          },
          {
            glAccountId: '00000000-0000-4000-8000-0000000000a2',
            accountCode: 'gl-tax',
            name: 'Tax',
            accountType: 'liability',
            isGroup: false,
            isSystem: false,
            isBankAccount: false,
            isActive: true,
            currencyCode: 'AUD',
          },
          {
            glAccountId: '00000000-0000-4000-8000-0000000000a3',
            accountCode: 'gl-grni',
            name: 'GRNI',
            accountType: 'liability',
            isGroup: false,
            isSystem: false,
            isBankAccount: false,
            isActive: true,
            currencyCode: 'AUD',
          },
          {
            glAccountId: '00000000-0000-4000-8000-0000000000a4',
            accountCode: 'gl-expense',
            name: 'Expense',
            accountType: 'expense',
            isGroup: false,
            isSystem: false,
            isBankAccount: false,
            isActive: true,
            currencyCode: 'AUD',
          },
          {
            glAccountId: '00000000-0000-4000-8000-0000000000a5',
            accountCode: 'gl-ppv',
            name: 'PPV',
            accountType: 'expense',
            isGroup: false,
            isSystem: false,
            isBankAccount: false,
            isActive: true,
            currencyCode: 'AUD',
          },
          {
            glAccountId: '00000000-0000-4000-8000-0000000000a6',
            accountCode: 'gl-fx-gain',
            name: 'FX Gain',
            accountType: 'revenue',
            isGroup: false,
            isSystem: false,
            isBankAccount: false,
            isActive: true,
            currencyCode: 'AUD',
          },
          {
            glAccountId: '00000000-0000-4000-8000-0000000000a7',
            accountCode: 'gl-fx-loss',
            name: 'FX Loss',
            accountType: 'expense',
            isGroup: false,
            isSystem: false,
            isBankAccount: false,
            isActive: true,
            currencyCode: 'AUD',
          },
        ])
        .onConflictDoNothing();

      // Create a PO in EUR at rate 1.5
      await pg.db
        .insert(purchaseOrders)
        .values({
          purchaseOrderId: soId,
          orderNumber: 'PO-FX-001',
          vendorId: VENDOR_ID, // reused dummy id for party
          deliveryLocationId: LOCATION_ID,
          currencyCode: 'EUR',
          exchangeRate: '1.5',
          stateCode: PURCHASE_ORDER_STATE.RECEIVED,
          baseTotalAmount: '0',
          createdBy: 'system',
        })
        .onConflictDoNothing();

      const poLineId = randomUUID();
      await pg.db
        .insert(purchaseOrderLineItems)
        .values({
          purchaseOrderLineId: poLineId,
          purchaseOrderId: soId,
          lineNumber: 1,
          productId: PRODUCT_ID,
          taxCategoryId: TAX_CAT_ID,
          quantity: '10',
          pricePerUnit: '10.00',
          discountPercentage: '0',
          amount: '0',
          tax: '0',
          quantityReceived: '0',
        })
        .onConflictDoNothing();

      // Create Goods Received at rate 1.5
      await pg.db.insert(goodsReceived).values({
        goodsReceivedId,
        receiptNumber: 'REC-FX-123',
        locationId: LOCATION_ID,
        vendorId: VENDOR_ID,
        stateCode: GOODS_RECEIVED_STATE.RECEIVED,
        createdBy: 'system',
      });

      await pg.db.insert(goodsReceivedLines).values({
        goodsReceivedLineId,
        goodsReceivedId,
        productId: PRODUCT_ID,
        quantityReceived: '10',
        unitCost: '15.00', // 10 EUR at rate 1.5 = 15 AUD per unit -> GRNI Credit = 150 AUD
        purchaseOrderLineId: poLineId,
        purchaseOrderId: soId,
        matchStatus: MATCH_STATUS.MATCHED,
        putawayStatus: PUTAWAY_STATUS.PENDING_PUTAWAY,
      });

      // Create Invoice in EUR at rate 1.6, and unit price 12 EUR
      await pg.db.insert(purchaseInvoices).values({
        invoiceId,
        invoiceNumber: 'INV-FX-123',
        vendorId: VENDOR_ID,
        purchaseOrderId: soId,
        totalAmount: '120.00', // 120 EUR
        taxAmount: '0.00',
        currencyCode: 'EUR',
        exchangeRate: '1.6', // 120 EUR * 1.6 = 192 AUD (AP Credit)
        stateCode: PURCHASE_INVOICE_STATE.DRAFT,
        outstandingAmount: '0',
        baseTotalAmount: '0',
        baseOutstandingAmount: '0',
        createdBy: 'system',
      });

      await pg.db.insert(purchaseInvoiceLines).values({
        invoiceLineId,
        invoiceId,
        productId: PRODUCT_ID,
        purchaseOrderLineId: poLineId,
        quantityInvoiced: '10',
        pricePerUnit: '12.00',
        amount: '120.00', // 120 EUR
        matchStatus: MATCH_STATUS.MATCHED,
      });

      await pg.db.insert(purchaseInvoiceReceipts).values({
        invoiceLineId,
        goodsReceivedLineId,
        quantityBilled: '10',
      });

      await service.postInvoice(invoiceId, 'admin');

      expect(mockGlService.postJournalEntry).toHaveBeenCalledTimes(1);
      const journalPayload = mockGlService.postJournalEntry!.mock.calls[0][0];

      // Base AP Credit should be 192
      const apLine = journalPayload.find((l: any) => l.accountCode === 'gl-ap');
      expect(apLine).toBeDefined();
      expect(apLine.credit).toBe(192);

      // Base GRNI Debit should be 150 (Clearing at Receipt rate 1.5 * 10 qty * 10 cost)
      const grniLine = journalPayload.find(
        (l: any) => l.accountCode === 'gl-grni',
      );
      expect(grniLine).toBeDefined();
      expect(grniLine.debit).toBe(150);

      // Trade PPV Debit should be (12 EUR invoice price - 10 EUR receipt price) * 10 qty * 1.6 Invoice Rate = 2 * 10 * 1.6 = 32 AUD.
      const ppvLine = journalPayload.find(
        (l: any) => l.accountCode === 'gl-ppv',
      );
      expect(ppvLine).toBeDefined();
      expect(ppvLine.debit).toBe(32);

      // FX Variance Debit should be (1.6 Invoice Rate - 1.5 Receipt Rate) * 10 qty * 10 receipt price EUR = 0.1 * 100 = 10 AUD.
      const fxLine = journalPayload.find(
        (l: any) => l.accountCode === 'gl-fx-loss',
      );
      expect(fxLine).toBeDefined();
      expect(fxLine.debit).toBe(10);
    });
  });
});
