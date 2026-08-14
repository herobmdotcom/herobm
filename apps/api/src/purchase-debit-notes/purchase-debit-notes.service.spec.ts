import { Test, TestingModule } from '@nestjs/testing';
import { PurchaseDebitNotesService } from './purchase-debit-notes.service';
import { GlService } from '../gl/gl.service';
import { AppConfigService } from '../settings/app-config.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { setupPgliteSuite } from '../test-utils/pglite-suite';
import {
  purchaseOrders,
  purchaseOrderLineItems,
  purchaseOrderReturns,
  purchaseOrderReturnLines,
  purchaseOrderReturnShipments,
  purchaseOrderReturnShipmentLines,
  purchaseDebitNotes,
  purchaseDebitNoteLines,
  suppliers,
  taxCategories,
  products,
  locations,
  uomDictionary,
  glAccounts,
  actors,
} from '@herobm/db-schema';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import {
  PURCHASE_ORDER_STATE,
  PURCHASE_RETURN_STATE,
  PURCHASE_RETURN_SHIPMENT_STATE,
  PURCHASE_DEBIT_NOTE_STATE,
  SUPPLIER_STATE,
  PRODUCT_STATE,
} from '@herobm/shared';

describe('PurchaseDebitNotesService', () => {
  const pg = setupPgliteSuite({ skipSeeds: true });
  let service: PurchaseDebitNotesService;
  let mockGlService: any;
  let mockAppConfig: any;

  const VENDOR_ID = randomUUID();
  const LOCATION_ID = randomUUID();
  const PROD_ID = randomUUID();
  const TAX_CAT_ID = randomUUID();
  const AP_ACCOUNT_ID = randomUUID();
  const EXPENSE_ACCOUNT_ID = randomUUID();
  const GRNI_ACCOUNT_ID = randomUUID();

  beforeEach(async () => {
    // Seed static reference data
    await pg.db
      .insert(uomDictionary)
      .values({ uomCode: 'EA', description: 'Each' })
      .onConflictDoNothing();

    await pg.db
      .insert(taxCategories)
      .values({
        taxCategoryId: TAX_CAT_ID,
        code: 'GST',
        title: 'GST',
        rate: '0.1',
        type: 'tax_applies',
      })
      .onConflictDoNothing();

    const [actor] = await pg.db
      .insert(actors)
      .values({
        actorId: randomUUID(),
        name: 'Test Supplier',
        isTaxRegistered: false,
      })
      .returning();

    await pg.db
      .insert(suppliers)
      .values({
        vendorId: VENDOR_ID,
        actorId: actor.actorId,
        vendorNumber: 'SUP-001',
        currencyCode: 'AUD',
        stateCode: SUPPLIER_STATE.ACTIVE,
        source: 'app',
        isPurchasingBlocked: false,
        createdBy: 'system',
      })
      .onConflictDoNothing();

    await pg.db
      .insert(locations)
      .values({
        locationId: LOCATION_ID,
        code: 'MAIN',
        name: 'Main Warehouse',
        source: 'MANUAL',
      })
      .onConflictDoNothing();

    await pg.db
      .insert(products)
      .values({
        productId: PROD_ID,
        productNumber: 'PROD-001',
        name: 'Widget 1',
        productType: 'inventory',
        baseUom: 'EA',
        standardCost: '10',
        stateCode: PRODUCT_STATE.ACTIVE,
        source: 'app',
        structureType: 'standard',
        createdBy: 'system',
      })
      .onConflictDoNothing();

    // GL Accounts
    await pg.db
      .insert(glAccounts)
      .values([
        {
          glAccountId: AP_ACCOUNT_ID,
          accountCode: '2000',
          name: 'Accounts Payable',
          accountType: 'liability',
          isGroup: false,
          isSystem: false,
          isBankAccount: false,
          isActive: true,
          currencyCode: 'AUD',
        },
        {
          glAccountId: EXPENSE_ACCOUNT_ID,
          accountCode: '5000',
          name: 'Purchase Expense',
          accountType: 'expense',
          isGroup: false,
          isSystem: false,
          isBankAccount: false,
          isActive: true,
          currencyCode: 'AUD',
        },
        {
          glAccountId: GRNI_ACCOUNT_ID,
          accountCode: '2100',
          name: 'GRNI Clearing',
          accountType: 'liability',
          isGroup: false,
          isSystem: false,
          isBankAccount: false,
          isActive: true,
          currencyCode: 'AUD',
        },
      ])
      .onConflictDoNothing();

    mockGlService = {
      getSettings: jest.fn().mockResolvedValue({
        defaultApAccountId: AP_ACCOUNT_ID,
        defaultExpenseAccountId: EXPENSE_ACCOUNT_ID,
        defaultGrniAccountId: GRNI_ACCOUNT_ID,
      }),
      postJournalEntry: jest
        .fn()
        .mockResolvedValue({ journalEntryId: randomUUID() }),
    };

    mockAppConfig = {
      inventoryAccountingMode: jest.fn().mockReturnValue('perpetual'),
      defaultCostCenterId: jest.fn().mockReturnValue(undefined),
      defaultActivityId: jest.fn().mockReturnValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchaseDebitNotesService,
        { provide: DRIZZLE, useValue: pg.db },
        { provide: GlService, useValue: mockGlService },
        { provide: AppConfigService, useValue: mockAppConfig },
      ],
    }).compile();

    service = module.get<PurchaseDebitNotesService>(PurchaseDebitNotesService);
  });

  async function createTestPOAndReturn(
    returnState: string = PURCHASE_RETURN_STATE.SHIPPED,
  ) {
    const poId = randomUUID();
    const poLineId = randomUUID();
    const returnId = randomUUID();
    const returnLineId = randomUUID();
    const shipmentId = randomUUID();
    const shipmentLineId = randomUUID();

    await pg.db.insert(purchaseOrders).values({
      purchaseOrderId: poId,
      orderNumber: `PO-${Date.now().toString().slice(-6)}`,
      vendorId: VENDOR_ID,
      deliveryLocationId: LOCATION_ID,
      stateCode: PURCHASE_ORDER_STATE.ORDERED,
      currencyCode: 'AUD',
      exchangeRate: '1',
    });

    await pg.db.insert(purchaseOrderLineItems).values({
      purchaseOrderLineId: poLineId,
      purchaseOrderId: poId,
      lineNumber: 1,
      taxCategoryId: TAX_CAT_ID,
      productId: PROD_ID,
      productDescription: 'Widget Line 1',
      quantity: '10',
      pricePerUnit: '10.00',
      amount: '100.00',
      quantityReceived: '10',
    });

    await pg.db.insert(purchaseOrderReturns).values({
      returnId: returnId,
      returnNumber: `PRET-${Date.now().toString().slice(-6)}`,
      purchaseOrderId: poId,
      stateCode: returnState as any,
      notes: 'Test return',
    });

    await pg.db.insert(purchaseOrderReturnLines).values({
      returnLineId: returnLineId,
      returnId: returnId,
      purchaseOrderLineId: poLineId,
      quantityReturned: '5',
      returnFee: '5.00',
      reason: 'Damaged in transit',
    });

    await pg.db.insert(purchaseOrderReturnShipments).values({
      shipmentId: shipmentId,
      shipmentNumber: `PRSH-${Date.now().toString().slice(-6)}`,
      returnId: returnId,
      stateCode: PURCHASE_RETURN_SHIPMENT_STATE.DISPATCHED,
      trackingNumber: 'TRACK-12345',
    });

    await pg.db.insert(purchaseOrderReturnShipmentLines).values({
      shipmentLineId: shipmentLineId,
      shipmentId: shipmentId,
      returnLineId: returnLineId,
      quantityShipped: '5',
    });

    return {
      poId,
      poLineId,
      returnId,
      returnLineId,
      shipmentId,
      shipmentLineId,
    };
  }

  describe('createDebitNote', () => {
    it('creates a debit note for a SHIPPED return with lines and allocations', async () => {
      const data = await createTestPOAndReturn(PURCHASE_RETURN_STATE.SHIPPED);

      const result = await service.createDebitNote(
        {
          returnId: data.returnId,
          supplierReferenceNumber: 'SUP-CR-999',
          notes: 'Debit Note for returned widgets',
          taxAmount: '5.00',
          feeAmount: '5.00',
          lines: [
            {
              purchaseOrderLineId: data.poLineId,
              quantityInvoiced: '5',
              pricePerUnit: '10.00',
              amount: '50.00',
              taxAmount: '5.00',
              shipmentAllocations: [
                {
                  shipmentLineId: data.shipmentLineId,
                  quantityCredited: '5',
                },
              ],
            },
          ],
        },
        'test-user',
      );

      expect(result).toBeDefined();
      expect(result.debitNoteNumber).toMatch(/^PDN-/);
      expect(result.supplierReferenceNumber).toBe('SUP-CR-999');
      expect(result.totalAmount).toBe('50.00');
      expect(result.stateCode).toBe(PURCHASE_DEBIT_NOTE_STATE.DRAFT);

      // Check DB records
      const [dn] = await pg.db
        .select()
        .from(purchaseDebitNotes)
        .where(eq(purchaseDebitNotes.debitNoteId, result.debitNoteId));
      expect(dn).toBeDefined();
      expect(dn.vendorId).toBe(VENDOR_ID);

      const lines = await pg.db
        .select()
        .from(purchaseDebitNoteLines)
        .where(eq(purchaseDebitNoteLines.debitNoteId, result.debitNoteId));
      expect(lines.length).toBe(1);
      expect(lines[0].amount).toBe('50.00');
    });

    it('throws BadRequestException if return is not in SHIPPED state', async () => {
      const data = await createTestPOAndReturn(PURCHASE_RETURN_STATE.DRAFT);

      await expect(
        service.createDebitNote(
          {
            returnId: data.returnId,
            lines: [
              {
                purchaseOrderLineId: data.poLineId,
                quantityInvoiced: '5',
                pricePerUnit: '10.00',
                amount: '50.00',
              },
            ],
          },
          'test-user',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException if return does not exist', async () => {
      await expect(
        service.createDebitNote(
          {
            returnId: randomUUID(),
            lines: [],
          },
          'test-user',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('postDebitNote', () => {
    it('posts a draft debit note and posts GL journal entries', async () => {
      const data = await createTestPOAndReturn(PURCHASE_RETURN_STATE.SHIPPED);

      const dn = await service.createDebitNote(
        {
          returnId: data.returnId,
          supplierReferenceNumber: 'SUP-CR-100',
          lines: [
            {
              purchaseOrderLineId: data.poLineId,
              quantityInvoiced: '5',
              pricePerUnit: '10.00',
              amount: '50.00',
            },
          ],
        },
        'test-user',
      );

      const posted = await service.postDebitNote(dn.debitNoteId, 'test-user');
      expect(posted.stateCode).toBe(PURCHASE_DEBIT_NOTE_STATE.POSTED);

      expect(mockGlService.postJournalEntry).toHaveBeenCalledTimes(1);
      const glCall = mockGlService.postJournalEntry.mock.calls[0];
      expect(glCall[0]).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            accountCode: '2000',
            debit: 50,
            credit: 0,
          }),
          expect.objectContaining({
            accountCode: '2100',
            debit: 0,
            credit: 50,
          }),
        ]),
      );
    });

    it('throws BadRequestException if debit note is already posted', async () => {
      const data = await createTestPOAndReturn(PURCHASE_RETURN_STATE.SHIPPED);
      const dn = await service.createDebitNote(
        {
          returnId: data.returnId,
          lines: [
            {
              purchaseOrderLineId: data.poLineId,
              quantityInvoiced: '5',
              pricePerUnit: '10.00',
              amount: '50.00',
            },
          ],
        },
        'test-user',
      );

      await service.postDebitNote(dn.debitNoteId, 'test-user');
      await expect(
        service.postDebitNote(dn.debitNoteId, 'test-user'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll and findOne', () => {
    it('findAll returns debit notes with lines and vendor details', async () => {
      const data = await createTestPOAndReturn(PURCHASE_RETURN_STATE.SHIPPED);
      await service.createDebitNote(
        {
          returnId: data.returnId,
          lines: [
            {
              purchaseOrderLineId: data.poLineId,
              quantityInvoiced: '5',
              pricePerUnit: '10.00',
              amount: '50.00',
            },
          ],
        },
        'test-user',
      );

      const list = await service.findAll();
      expect(list.length).toBeGreaterThanOrEqual(1);
      expect(list[0]).toHaveProperty('debitNoteNumber');
      expect(list[0]).toHaveProperty('vendorName', 'Test Supplier');
      expect(list[0].lines.length).toBe(1);
    });

    it('findOne returns a single debit note with line item details', async () => {
      const data = await createTestPOAndReturn(PURCHASE_RETURN_STATE.SHIPPED);
      const dn = await service.createDebitNote(
        {
          returnId: data.returnId,
          supplierReferenceNumber: 'REF-XYZ',
          lines: [
            {
              purchaseOrderLineId: data.poLineId,
              quantityInvoiced: '5',
              pricePerUnit: '10.00',
              amount: '50.00',
            },
          ],
        },
        'test-user',
      );

      const found = await service.findOne(dn.debitNoteId);
      expect(found).toBeDefined();
      expect(found.debitNoteId).toBe(dn.debitNoteId);
      expect(found.supplierReferenceNumber).toBe('REF-XYZ');
      expect(found.vendorName).toBe('Test Supplier');
      expect(found.lines[0].productDescription).toBe('Widget Line 1');
    });

    it('findOne throws NotFoundException when ID does not exist', async () => {
      await expect(service.findOne(randomUUID())).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
