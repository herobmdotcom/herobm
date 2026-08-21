import { Test, TestingModule } from '@nestjs/testing';
import { PurchasingReportsService } from './purchasing-reports.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { setupPgliteSuite } from '../test-utils/pglite-suite';
import { DataSourcesRegistry } from '../data-sources/data-sources.registry';
import {
  purchaseOrders,
  purchaseOrderLineItems,
  suppliers,
  locations,
  taxCategories,
  products,
  uomDictionary,
  actors,
} from '@herobm/db-schema';
import {
  PURCHASE_ORDER_STATE,
  SUPPLIER_STATE,
  PRODUCT_STATE,
  ACTOR_STATE,
} from '@herobm/shared';

describe('PurchasingReportsService', () => {
  const pg = setupPgliteSuite({ skipSeeds: true });
  let service: PurchasingReportsService;

  const SUPPLIER_ID = '00000000-0000-4000-8000-000000000001';
  const NO_ACTOR_SUPPLIER_ID = '00000000-0000-4000-8000-000000000003';
  const PO_ID_1 = '00000000-0000-4000-8000-000000000002';
  const PO_ID_2 = '00000000-0000-4000-8000-000000000004';
  const LOCATION_ID = '00000000-0000-4000-8000-00000000000f';
  const TAX_CAT_ID = '00000000-0000-4000-8000-000000000007';
  const PROD_ID = '00000000-0000-4000-8000-00000000000a';

  beforeEach(async () => {
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

    const [act] = await pg.db
      .insert(actors)
      .values({
        stateCode: ACTOR_STATE.ACTIVE,
        name: 'Industrial Supplies Ltd',
        headquartersAddressLine1: 'AU',
        isTaxRegistered: false,
      })
      .returning();

    await pg.db.insert(suppliers).values({
      actorId: act.actorId,
      vendorId: SUPPLIER_ID,
      vendorNumber: 'VEN001',
      currencyCode: 'EUR',
      stateCode: SUPPLIER_STATE.ACTIVE,
      isPurchasingBlocked: false,
      source: 'app',
      createdBy: 'system',
    });

    await pg.db.insert(suppliers).values({
      actorId: null,
      vendorId: NO_ACTOR_SUPPLIER_ID,
      vendorNumber: 'VEN_NO_ACTOR',
      currencyCode: 'EUR',
      stateCode: SUPPLIER_STATE.ACTIVE,
      isPurchasingBlocked: false,
      source: 'app',
      createdBy: 'system',
    });

    await pg.db.insert(products).values({
      productId: PROD_ID,
      productNumber: 'P1',
      name: 'Product 1',
      baseUom: 'EA',
      productType: 'inventory',
      stateCode: PRODUCT_STATE.ACTIVE,
      source: 'app',
      structureType: 'standard',
      createdBy: 'system',
    });

    // PO 1 for standard supplier with actor
    await pg.db.insert(purchaseOrders).values({
      purchaseOrderId: PO_ID_1,
      orderNumber: 'PO-001',
      name: 'PO 1',
      vendorId: SUPPLIER_ID,
      stateCode: PURCHASE_ORDER_STATE.ORDERED,
      createdBy: 'admin',
      createdOn: new Date('2026-08-20T10:00:00Z'),
      expectedDate: new Date('2026-08-25T00:00:00Z'),
      currencyCode: 'EUR',
      deliveryLocationId: LOCATION_ID,
      exchangeRate: '1',
    });

    await pg.db.insert(purchaseOrderLineItems).values({
      purchaseOrderId: PO_ID_1,
      lineNumber: 1,
      productId: PROD_ID,
      quantity: '5',
      pricePerUnit: '100.00',
      totalAmount: '500.00',
      tax: '0.00',
      amount: '500.00',
      taxCategoryId: TAX_CAT_ID,
    });

    // PO 2 for supplier without actor
    await pg.db.insert(purchaseOrders).values({
      purchaseOrderId: PO_ID_2,
      orderNumber: 'PO-002',
      name: 'PO 2',
      vendorId: NO_ACTOR_SUPPLIER_ID,
      stateCode: PURCHASE_ORDER_STATE.ORDERED,
      createdBy: 'admin',
      createdOn: new Date('2026-08-21T16:00:00Z'),
      expectedDate: new Date('2026-08-26T00:00:00Z'),
      currencyCode: 'EUR',
      deliveryLocationId: LOCATION_ID,
      exchangeRate: '1',
    });

    await pg.db.insert(purchaseOrderLineItems).values({
      purchaseOrderId: PO_ID_2,
      lineNumber: 1,
      productId: PROD_ID,
      quantity: '2',
      pricePerUnit: '150.00',
      totalAmount: '300.00',
      tax: '0.00',
      amount: '300.00',
      taxCategoryId: TAX_CAT_ID,
    });
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchasingReportsService,
        { provide: DRIZZLE, useValue: pg.db },
        { provide: DataSourcesRegistry, useValue: { register: jest.fn() } },
      ],
    }).compile();

    service = module.get<PurchasingReportsService>(PurchasingReportsService);
  });

  describe('getPurchasesBySupplier', () => {
    it('should properly resolve supplier name with actor and fallback to vendorNumber', async () => {
      const report: any[] = await service.getPurchasesBySupplier({
        fromDate: '2026-08-19',
        toDate: '2026-08-21',
      });

      expect(report.length).toBe(2);

      const standardRow = report.find(
        (r: any) => r.supplierName === 'Industrial Supplies Ltd',
      );
      expect(standardRow).toBeDefined();
      expect(standardRow?.orderCount).toBe(1);
      expect(Number(standardRow?.totalSpend)).toBe(500);

      const fallbackRow = report.find(
        (r: any) => r.supplierName === 'VEN_NO_ACTOR',
      );
      expect(fallbackRow).toBeDefined();
      expect(fallbackRow?.orderCount).toBe(1);
      expect(Number(fallbackRow?.totalSpend)).toBe(300);
    });
  });

  describe('getOutstandingPOs', () => {
    it('should return non-null supplier name and include daytime records on toDate', async () => {
      const report: any[] = await service.getOutstandingPOs({
        toDate: '2026-08-30',
      });

      expect(report.length).toBe(2);
      expect(
        report.every((r: any) => r.supplierName && r.supplierName !== ''),
      ).toBe(true);
    });
  });
});
