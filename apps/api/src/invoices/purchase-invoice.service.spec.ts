import { Test, TestingModule } from '@nestjs/testing';
import { PurchaseInvoiceService } from './purchase-invoice.service';
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
} from '../drizzle/modbm-core-schema';
import { PgliteDatabase } from 'drizzle-orm/pglite';
import { eq } from 'drizzle-orm';
import { PURCHASE_ORDER_STATE } from '@modbm/shared';

describe('PurchaseInvoiceService', () => {
  const pg = setupPgliteSuite({ skipSeeds: true });
  let service: PurchaseInvoiceService;
  let mockGlService: any;

  const VENDOR_ID = '00000000-0000-0000-0000-000000000001';
  const PO_ID = '00000000-0000-0000-0000-000000000002';
  const PRODUCT_ID = '00000000-0000-0000-0000-00000000000a';
  const TAX_CAT_ID = '00000000-0000-0000-0000-000000000007';
  const LOCATION_ID = '00000000-0000-0000-0000-00000000000f';

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
    });

    await pg.db.insert(suppliers).values({
      vendorId: VENDOR_ID,
      vendorNumber: 'V001',
      name: 'Steel Co',
      currencyCode: 'AUD',
    });

    await pg.db.insert(products).values({
      productId: PRODUCT_ID,
      productNumber: 'P1',
      name: 'Product 1',
      baseUom: 'EA',
    });
  });

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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchaseInvoiceService,
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
          useValue: {
            get: jest.fn(),
            inventoryAccountingMode: jest.fn().mockReturnValue('perpetual'),
          },
        },
      ],
    }).compile();

    service = module.get<PurchaseInvoiceService>(PurchaseInvoiceService);

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
    });

    await pg.db.insert(purchaseOrderLineItems).values({
      purchaseOrderLineId: '00000000-0000-0000-0000-000000000003',
      purchaseOrderId: PO_ID,
      lineNumber: 1,
      productId: PRODUCT_ID,
      quantity: '10',
      quantityReceived: '10',
      pricePerUnit: '15.00',
      tax: '1.50',
      amount: '150.00',
    });
  }

  describe('findOne', () => {
    it('should throw NotFoundException for unknown bill', async () => {
      await expect(
        service.findOne('00000000-0000-0000-0000-000000000888'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByOrder', () => {
    it('should return empty array when no bills exist', async () => {
      const result = await service.findByOrder(PO_ID);
      expect(result).toEqual([]);
    });
  });
});
