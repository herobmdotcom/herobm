import { Test, TestingModule } from '@nestjs/testing';
import { PurchaseOrdersService } from './purchase-orders.service';
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
  actors,
  procurementEvents,
  exchangeRates,
} from '@herobm/db-schema';
import { eq } from 'drizzle-orm';
import {
  PURCHASE_ORDER_STATE,
  SUPPLIER_STATE,
  PRODUCT_STATE,
  ACTOR_STATE,
} from '@herobm/shared';
import { InventoryMovementService } from '../inventory/inventory-movement.service';
import { InventoryQueryService } from '../inventory/inventory-query.service';

jest.setTimeout(120000);

describe('PurchaseOrdersService', () => {
  const pg = setupPgliteSuite({ skipSeeds: true });
  let service: PurchaseOrdersService;

  let mockInventoryService: any;

  let mockSuppliersService: any;

  let mockTaxCategoriesService: any;

  let mockTaxResolutionEngine: any;

  const VENDOR_ID = '00000000-0000-4000-8000-000000000002';
  const PROD_ID = '00000000-0000-4000-8000-00000000000a';
  const LOCATION_ID = '00000000-0000-4000-8000-00000000000f';
  const TAX_CAT_ID = '00000000-0000-4000-8000-000000000007';

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
      source: 'app',
      createdBy: 'system',
    });
    const actorId = '0e3c4e85-d865-4f40-8abf-c4e89e47261d';
    await pg.db.insert(actors).values({
      actorId,
      name: 'Test Vendor',
      headquartersAddressLine1: 'AU',
      isTaxRegistered: false,
    });
    await pg.db.insert(suppliers).values({
      vendorId: VENDOR_ID,
      actorId,
      vendorNumber: 'V001',
      currencyCode: 'EUR',
      stateCode: SUPPLIER_STATE.ACTIVE,
      source: 'app',
      isPurchasingBlocked: false,
      createdBy: 'system',
    });
    await pg.db.insert(products).values({
      productId: PROD_ID,
      productNumber: 'P1',
      name: 'Product 1',
      productType: 'inventory',
      baseUom: 'EA',
      purchaseTaxCategoryId: TAX_CAT_ID,
      stateCode: PRODUCT_STATE.ACTIVE,
      source: 'app',
      structureType: 'standard',
      createdBy: 'system',
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
      getById: jest.fn().mockResolvedValue({ taxCategoryId: TAX_CAT_ID }),
    };
    mockTaxResolutionEngine = {
      resolveTaxCategory: jest.fn().mockResolvedValue(TAX_CAT_ID),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchaseOrdersService,
        { provide: DRIZZLE, useValue: pg.db },
        { provide: InventoryQueryService, useValue: mockInventoryService },
        { provide: SuppliersService, useValue: mockSuppliersService },
        { provide: TaxCategoriesService, useValue: mockTaxCategoriesService },
        { provide: TaxResolutionEngine, useValue: mockTaxResolutionEngine },
        {
          provide: AppConfigService,
          useValue: {
            homeCurrency: () => 'EUR',
            getAppSettingsRaw: () => ({ defaultSupplierTaxPositionId: null }),
          },
        },
        {
          provide: BackordersService,
          useValue: { changeBackorderState: jest.fn() },
        },
        { provide: InventoryMovementService, useValue: mockInventoryService },
      ],
    }).compile();

    await pg.db
      .insert(exchangeRates)
      .values([
        {
          currencyCode: 'EUR',
          currencyName: 'Euro',
          effectiveDate: new Date('2000-01-01'),
          buyRate: '0.85',
          sellRate: '0.85',
        },
        {
          currencyCode: 'AUD',
          currencyName: 'Australian Dollar',
          effectiveDate: new Date('2000-01-01'),
          buyRate: '1.0',
          sellRate: '1.0',
        },
      ])
      .onConflictDoNothing();

    service = module.get<PurchaseOrdersService>(PurchaseOrdersService);
  });

  describe('create', () => {
    it('should throw BadRequestException if supplier is inactive', async () => {
      const INACTIVE_VENDOR_ID = '00000000-0000-4000-8000-000000000200';
      const actorId = '0e3c4e85-d865-4f40-8abf-c4e89e47262d';
      await pg.db.insert(actors).values({
        actorId,
        name: 'Inactive Vendor',
        isTaxRegistered: false,
        stateCode: ACTOR_STATE.ARCHIVED,
      });
      await pg.db.insert(suppliers).values({
        vendorId: INACTIVE_VENDOR_ID,
        actorId,
        vendorNumber: 'V002',
        currencyCode: 'EUR',
        stateCode: SUPPLIER_STATE.ARCHIVED,
        source: 'app',
        isPurchasingBlocked: false,
        createdBy: 'system',
      });

      await expect(
        service.create(
          {
            orderNumber: 'PO-INACT-1',
            deliveryLocationId: LOCATION_ID,
            vendorId: INACTIVE_VENDOR_ID,
          },
          'system',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if a line item product is inactive', async () => {
      const INACTIVE_PROD_ID = '00000000-0000-4000-8000-00000000020a';
      await pg.db.insert(products).values({
        productId: INACTIVE_PROD_ID,
        productNumber: 'P2',
        name: 'Inactive Product',
        productType: 'inventory',
        baseUom: 'EA',
        purchaseTaxCategoryId: TAX_CAT_ID,
        stateCode: PRODUCT_STATE.ARCHIVED,
        source: 'app',
        structureType: 'standard',
        createdBy: 'system',
      });

      await expect(
        service.create(
          {
            orderNumber: 'PO-INACT-2',
            deliveryLocationId: LOCATION_ID,
            vendorId: VENDOR_ID,
            lines: [
              {
                productId: INACTIVE_PROD_ID,
                quantity: '1',
                pricePerUnit: '10',
              },
            ],
          },
          'system',
        ),
      ).rejects.toThrow(BadRequestException);
    });

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
      const poId = '00000000-0000-4000-8000-000000000101';
      await pg.db.insert(purchaseOrders).values({
        purchaseOrderId: poId,
        orderNumber: 'PO-STATE-' + Math.random(),
        vendorId: VENDOR_ID,
        deliveryLocationId: LOCATION_ID,
        currencyCode: 'EUR',
        stateCode: PURCHASE_ORDER_STATE.DRAFT,
        baseTotalAmount: '0',
        exchangeRate: '1',
        createdBy: 'system',
      });

      const result = await service.changePurchaseOrderState(
        poId,
        PURCHASE_ORDER_STATE.ORDERED,
      );
      expect(result.stateCode).toBe(PURCHASE_ORDER_STATE.ORDERED);
    });

    it('should throw BadRequestException if purchasing is blocked', async () => {
      const poId = '00000000-0000-4000-8000-000000000109';
      await pg.db.insert(purchaseOrders).values({
        purchaseOrderId: poId,
        orderNumber: 'PO-BLOCKED-' + Math.random(),
        vendorId: VENDOR_ID,
        deliveryLocationId: LOCATION_ID,
        currencyCode: 'EUR',
        stateCode: PURCHASE_ORDER_STATE.DRAFT,
        baseTotalAmount: '0',
        exchangeRate: '1',
        createdBy: 'system',
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
      const poId = '00000000-0000-4000-8000-000000000102';
      await pg.db.insert(purchaseOrders).values({
        purchaseOrderId: poId,
        orderNumber: 'PO-LINE-' + Math.random(),
        vendorId: VENDOR_ID,
        deliveryLocationId: LOCATION_ID,
        currencyCode: 'EUR',
        stateCode: PURCHASE_ORDER_STATE.DRAFT,
        baseTotalAmount: '0',
        exchangeRate: '1',
        createdBy: 'system',
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

    it('should throw BadRequestException if adding an inactive product', async () => {
      const poId = '00000000-0000-4000-8000-000000000103';
      await pg.db.insert(purchaseOrders).values({
        purchaseOrderId: poId,
        orderNumber: 'PO-LINE-2-' + Math.random(),
        vendorId: VENDOR_ID,
        deliveryLocationId: LOCATION_ID,
        currencyCode: 'EUR',
        stateCode: PURCHASE_ORDER_STATE.DRAFT,
        baseTotalAmount: '0',
        exchangeRate: '1',
        createdBy: 'system',
      });

      const INACTIVE_PROD_ID = '00000000-0000-4000-8000-00000000020b';
      await pg.db.insert(products).values({
        productId: INACTIVE_PROD_ID,
        productNumber: 'P3',
        name: 'Inactive Product',
        productType: 'inventory',
        baseUom: 'EA',
        purchaseTaxCategoryId: TAX_CAT_ID,
        stateCode: PRODUCT_STATE.ARCHIVED,
        source: 'app',
        structureType: 'standard',
        createdBy: 'system',
      });

      await expect(
        service.addLine(poId, {
          productId: INACTIVE_PROD_ID,
          quantity: '5',
          pricePerUnit: '10',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
