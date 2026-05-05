import { Test, TestingModule } from '@nestjs/testing';
import { PurchaseInvoiceService } from './purchase-invoice.service';
import { GlService } from '../gl/gl.service';
import { TaxCategoriesService } from '../tax/tax-categories.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { AppConfigService } from '../settings/app-config.service';
import { createMemoryDb } from '../../test/utils/memory-db';
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

describe('PurchaseInvoiceService', () => {
  let service: PurchaseInvoiceService;
  let db: PgliteDatabase<any>;
  let mockGlService: any;

  const VENDOR_ID = '00000000-0000-0000-0000-000000000001';
  const PO_ID = '00000000-0000-0000-0000-000000000002';
  const PRODUCT_ID = '00000000-0000-0000-0000-00000000000a';
  const TAX_CAT_ID = '00000000-0000-0000-0000-000000000007';
  const LOCATION_ID = '00000000-0000-0000-0000-00000000000f';

  beforeAll(async () => {
    const mem = await createMemoryDb({ skipSeeds: true });
    db = mem.db;

    // Seed static data
    await db.insert(uomDictionary).values({
      uomCode: 'EA',
      description: 'Each',
    });

    await db.insert(taxCategories).values({
      taxCategoryId: TAX_CAT_ID,
      code: 'GST',
      title: 'GST',
      rate: '0.1',
      type: 'tax_applies',
    });

    await db.insert(locations).values({
      locationId: LOCATION_ID,
      code: 'MAIN',
      name: 'Main Warehouse',
    });

    await db.insert(suppliers).values({
      vendorId: VENDOR_ID,
      vendorNumber: 'V001',
      name: 'Steel Co',
      currencyCode: 'AUD',
    });

    await db.insert(products).values({
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
        { provide: DRIZZLE, useValue: db },
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
    await db.delete(purchaseOrderLineItems);
    await db.delete(purchaseOrders);
  });

  async function seedPO(stateCode: string = 'received') {
    await db.insert(purchaseOrders).values({
      purchaseOrderId: PO_ID,
      orderNumber: 'PO-1',
      vendorId: VENDOR_ID,
      stateCode: stateCode as any,
      currencyCode: 'AUD',
      deliveryLocationId: LOCATION_ID,
    });

    await db.insert(purchaseOrderLineItems).values({
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
