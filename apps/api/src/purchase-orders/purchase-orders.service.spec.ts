import { Test, TestingModule } from '@nestjs/testing';
import { PurchaseOrdersService } from './purchase-orders.service';
import { InventoryService } from '../inventory/inventory.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { SuppliersService } from '../suppliers/suppliers.service';
import { TaxCategoriesService } from '../tax/tax-categories.service';
import { AppConfigService } from '../settings/app-config.service';
import { setupPgliteSuite } from '../test-utils/pglite-suite';
import { BackordersService } from '../orders/backorders.service';
import { TaxResolutionEngine } from '../tax/tax-resolution.engine';
import {
  purchaseOrders,
  purchaseOrderLineItems,
  locations,
  products,
  uomDictionary,
  taxCategories,
  suppliers,
  procurementEvents,
} from '../drizzle/herobm-core-schema';
import { eq } from 'drizzle-orm';
import { PURCHASE_ORDER_STATE, SUPPLIER_STATE } from '@herobm/shared';

jest.setTimeout(120000);

describe('PurchaseOrdersService', () => {
  const pg = setupPgliteSuite({ skipSeeds: true });
  let service: PurchaseOrdersService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockInventoryService: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockSuppliersService: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockTaxCategoriesService: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockTaxResolutionEngine: any;

  const VENDOR_ID = '00000000-0000-0000-0000-000000000002';
  const PROD_ID = '00000000-0000-0000-0000-00000000000a';
  const LOCATION_ID = '00000000-0000-0000-0000-00000000000f';
  const TAX_CAT_ID = '00000000-0000-0000-0000-000000000007';

  beforeEach(async () => {
    // Seed infrastructure ONCE
    await pg.db
      .insert(uomDictionary)
      .values({ uomCode: 'EA', description: 'Each' });
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
      name: 'Test Vendor',
      currencyCode: 'EUR',
      stateCode: SUPPLIER_STATE.ACTIVE,
      address1Country: 'AU',
    });
    await pg.db.insert(products).values({
      productId: PROD_ID,
      productNumber: 'P1',
      name: 'Product 1',
      baseUom: 'EA',
      purchaseTaxCategoryId: TAX_CAT_ID,
    });
  });

  beforeEach(async () => {
    await pg.db.delete(purchaseOrderLineItems);
    await pg.db.delete(procurementEvents);
    await pg.db.delete(purchaseOrders);

    mockInventoryService = { recordInventoryMovement: jest.fn() };
    mockSuppliersService = {
      findOne: jest.fn().mockResolvedValue({ vendorId: VENDOR_ID }),
      assessRisk: jest.fn().mockResolvedValue({
        isPurchasingBlocked: false,
        purchasingBlockReasons: [],
      }),
    };
    mockTaxCategoriesService = {
      getDefault: jest.fn().mockResolvedValue({ taxCategoryId: TAX_CAT_ID }),
      getById: jest.fn().mockResolvedValue({ taxCategoryId: TAX_CAT_ID }),
    };
    mockTaxResolutionEngine = {
      resolveTaxCategory: jest.fn().mockResolvedValue(TAX_CAT_ID),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchaseOrdersService,
        { provide: DRIZZLE, useValue: pg.db },
        { provide: InventoryService, useValue: mockInventoryService },
        { provide: SuppliersService, useValue: mockSuppliersService },
        { provide: TaxCategoriesService, useValue: mockTaxCategoriesService },
        { provide: TaxResolutionEngine, useValue: mockTaxResolutionEngine },
        {
          provide: AppConfigService,
          useValue: { homeCurrency: () => 'EUR' },
        },
        {
          provide: BackordersService,
          useValue: { changeBackorderState: jest.fn() },
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
      expect(result.stateCode).toBe(PURCHASE_ORDER_STATE.DRAFT);
    });
  });

  describe('changePurchaseOrderState', () => {
    it('should transition state from draft to ordered', async () => {
      const poId = '00000000-0000-0000-0000-000000000101';
      await pg.db.insert(purchaseOrders).values({
        purchaseOrderId: poId,
        orderNumber: 'PO-STATE-' + Math.random(),
        vendorId: VENDOR_ID,
        deliveryLocationId: LOCATION_ID,
        currencyCode: 'EUR',
        stateCode: PURCHASE_ORDER_STATE.DRAFT,
      });

      const result = await service.changePurchaseOrderState(
        poId,
        PURCHASE_ORDER_STATE.ORDERED,
      );
      expect(result.stateCode).toBe(PURCHASE_ORDER_STATE.ORDERED);
    });

    it('should throw BadRequestException if purchasing is blocked', async () => {
      const poId = '00000000-0000-0000-0000-000000000109';
      await pg.db.insert(purchaseOrders).values({
        purchaseOrderId: poId,
        orderNumber: 'PO-BLOCKED-' + Math.random(),
        vendorId: VENDOR_ID,
        deliveryLocationId: LOCATION_ID,
        currencyCode: 'EUR',
        stateCode: PURCHASE_ORDER_STATE.DRAFT,
      });

      mockSuppliersService.assessRisk.mockResolvedValueOnce({
        isPurchasingBlocked: true,
        purchasingBlockReasons: ['supplier_inactive'],
      });

      await expect(
        service.changePurchaseOrderState(poId, PURCHASE_ORDER_STATE.ORDERED),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('addLine', () => {
    it('should add a line item to a draft order', async () => {
      const poId = '00000000-0000-0000-0000-000000000102';
      await pg.db.insert(purchaseOrders).values({
        purchaseOrderId: poId,
        orderNumber: 'PO-LINE-' + Math.random(),
        vendorId: VENDOR_ID,
        deliveryLocationId: LOCATION_ID,
        currencyCode: 'EUR',
        stateCode: PURCHASE_ORDER_STATE.DRAFT,
      });

      await service.addLine(poId, {
        productId: PROD_ID,
        quantity: '5',
        pricePerUnit: '10',
      });

      const lines = await pg.db
        .select()
        .from(purchaseOrderLineItems)
        .where(eq(purchaseOrderLineItems.purchaseOrderId, poId));
      expect(lines).toHaveLength(1);
    });
  });
});
