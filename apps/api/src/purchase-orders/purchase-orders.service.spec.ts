import { Test, TestingModule } from '@nestjs/testing';
import { PurchaseOrdersService } from './purchase-orders.service';
import { InventoryService } from '../inventory/inventory.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { SuppliersService } from '../suppliers/suppliers.service';
import { TaxCategoriesService } from '../tax/tax-categories.service';
import { AppConfigService } from '../settings/app-config.service';
import { createMemoryDb } from '../../test/utils/memory-db';
import {
  purchaseOrders,
  purchaseOrderLineItems,
  locations,
  products,
  uomDictionary,
  taxCategories,
  suppliers,
} from '../drizzle/modbm-core-schema';
import { PgliteDatabase } from 'drizzle-orm/pglite';
import { eq } from 'drizzle-orm';

jest.setTimeout(120000); // 2 minutes for the whole suite

describe('PurchaseOrdersService', () => {
  let service: PurchaseOrdersService;
  let db: PgliteDatabase<any>;
  let mockInventoryService: any;
  let mockSuppliersService: any;
  let mockTaxCategoriesService: any;

  const VENDOR_ID = '00000000-0000-0000-0000-000000000002';
  const PROD_ID = '00000000-0000-0000-0000-00000000000a';
  const LOCATION_ID = '00000000-0000-0000-0000-00000000000f';
  const TAX_CAT_ID = '00000000-0000-0000-0000-000000000007';

  beforeAll(async () => {
    const mem = await createMemoryDb({ skipSeeds: true });
    db = mem.db;

    // Seed infrastructure ONCE
    await db.insert(uomDictionary).values({ uomCode: 'EA', description: 'Each' });
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
      name: 'Test Vendor',
      currencyCode: 'EUR',
      stateCode: 'active',
    });
    await db.insert(products).values({
      productId: PROD_ID,
      productNumber: 'P1',
      name: 'Product 1',
      baseUom: 'EA',
      purchaseTaxCategoryId: TAX_CAT_ID,
    });
  });

  beforeEach(async () => {
    mockInventoryService = { recordInventoryMovement: jest.fn() };
    mockSuppliersService = { findOne: jest.fn().mockResolvedValue({ vendorId: VENDOR_ID }) };
    mockTaxCategoriesService = {
      getDefault: jest.fn().mockResolvedValue({ taxCategoryId: TAX_CAT_ID }),
      getById: jest.fn().mockResolvedValue({ taxCategoryId: TAX_CAT_ID }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchaseOrdersService,
        { provide: DRIZZLE, useValue: db },
        { provide: InventoryService, useValue: mockInventoryService },
        { provide: SuppliersService, useValue: mockSuppliersService },
        { provide: TaxCategoriesService, useValue: mockTaxCategoriesService },
        {
          provide: AppConfigService,
          useValue: { homeCurrency: () => 'EUR' },
        },
      ],
    }).compile();

    service = module.get<PurchaseOrdersService>(PurchaseOrdersService);
  });

  describe('create', () => {
    it('should create a purchase order and return it', async () => {
      const dto = {
        orderNumber: 'PO-NEW-' + Math.random(),
        vendorId: VENDOR_ID,
        deliveryLocationId: LOCATION_ID,
        currencyCode: 'EUR',
        lines: [{ productId: PROD_ID, quantity: '10', pricePerUnit: '100' }],
      };

      const result = await service.create(dto, 'admin');
      expect(result.salesOrderId).toBeDefined();
      expect(result.stateCode).toBe('draft');
    });
  });

  describe('changeState', () => {
    it('should transition state from draft to ordered', async () => {
      const poId = '00000000-0000-0000-0000-000000000101';
      await db.insert(purchaseOrders).values({
        purchaseOrderId: poId,
        orderNumber: 'PO-STATE-' + Math.random(),
        vendorId: VENDOR_ID,
        deliveryLocationId: LOCATION_ID,
        currencyCode: 'EUR',
        stateCode: 'draft',
      });

      const result = await service.changeState(poId, 'ordered');
      expect(result.stateCode).toBe('ordered');
    });
  });

  describe('addLine', () => {
    it('should add a line item to a draft order', async () => {
      const poId = '00000000-0000-0000-0000-000000000102';
      await db.insert(purchaseOrders).values({
        purchaseOrderId: poId,
        orderNumber: 'PO-LINE-' + Math.random(),
        vendorId: VENDOR_ID,
        deliveryLocationId: LOCATION_ID,
        currencyCode: 'EUR',
        stateCode: 'draft',
      });

      await service.addLine(poId, { productId: PROD_ID, quantity: '5', pricePerUnit: '10' });
      
      const lines = await db.select().from(purchaseOrderLineItems).where(eq(purchaseOrderLineItems.purchaseOrderId, poId));
      expect(lines).toHaveLength(1);
    });
  });
});
