import { Test, TestingModule } from '@nestjs/testing';
import { SetupService } from './setup.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { setupPgliteSuite } from '../test-utils/pglite-suite';
import { AppConfigService } from '../settings/app-config.service';
import {
  customers,
  suppliers,
  organizations,
  customerGroups,
  supplierGroups,
  tradingTerms,
  taxPositions,
  products,
  productGroups,
  uomDictionary,
  salesOrders,
  locations,
  systemEvents,
} from '@herobm/db-schema';
import { BadRequestException } from '@nestjs/common';
import {
  CUSTOMER_STATE,
  SUPPLIER_STATE,
  PRODUCT_STATE,
  ORGANIZATION_STATE,
  SALES_ORDER_STATE,
} from '@herobm/shared';
import { parse } from 'csv-parse/sync';
import {
  getAllCsvProjections,
  getCsvProjection,
  hasCsvProjection,
} from './setup-csv-projections';

describe('CSV Extended Projections (Unit)', () => {
  const pg = setupPgliteSuite({ skipSeeds: true });
  let service: SetupService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SetupService,
        { provide: DRIZZLE, useValue: pg.db },
        {
          provide: AppConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<SetupService>(SetupService);

    // Clean tables in FK order
    await pg.db.delete(salesOrders);
    await pg.db.delete(products);
    await pg.db.delete(customers);
    await pg.db.delete(suppliers);
    await pg.db.delete(customerGroups);
    await pg.db.delete(supplierGroups);
    await pg.db.delete(productGroups);
    await pg.db.delete(uomDictionary);
    await pg.db.delete(locations);
    await pg.db.delete(tradingTerms);
    await pg.db.delete(taxPositions);
    await pg.db.delete(organizations);
    await pg.db.delete(systemEvents);
  });

  describe('Registry & Metadata', () => {
    it('should register all 4 extended projections', () => {
      expect(hasCsvProjection('customers_extended')).toBe(true);
      expect(hasCsvProjection('suppliers_extended')).toBe(true);
      expect(hasCsvProjection('products_extended')).toBe(true);
      expect(hasCsvProjection('sales_orders_extended')).toBe(true);
      expect(hasCsvProjection('unknown_projection')).toBe(false);

      const projections = getAllCsvProjections();
      expect(projections.length).toBe(4);
      expect(projections.map((p) => p.name)).toEqual(
        expect.arrayContaining([
          'Customers (Extended)',
          'Suppliers (Extended)',
          'Products (Extended)',
          'Sales Orders (Extended)',
        ]),
      );
    });

    it('getCsvMetadata includes extended projections flagged as exportOnly: true', async () => {
      const metadata = await service.getCsvMetadata();

      const custExt = metadata.find((m) => m.id === 'customers_extended');
      expect(custExt).toBeDefined();
      expect(custExt?.name).toBe('Customers (Extended)');
      expect(custExt?.exportOnly).toBe(true);
      expect(custExt?.columns).toContain('customer_name');
      expect(custExt?.columns).toContain('customer_group_name');

      const suppExt = metadata.find((m) => m.id === 'suppliers_extended');
      expect(suppExt).toBeDefined();
      expect(suppExt?.name).toBe('Suppliers (Extended)');
      expect(suppExt?.exportOnly).toBe(true);
      expect(suppExt?.columns).toContain('supplier_name');
      expect(suppExt?.columns).toContain('supplier_group_name');

      const prodExt = metadata.find((m) => m.id === 'products_extended');
      expect(prodExt).toBeDefined();
      expect(prodExt?.name).toBe('Products (Extended)');
      expect(prodExt?.exportOnly).toBe(true);
      expect(prodExt?.columns).toContain('product_group_name');
      expect(prodExt?.columns).toContain('base_uom_description');

      const soExt = metadata.find((m) => m.id === 'sales_orders_extended');
      expect(soExt).toBeDefined();
      expect(soExt?.name).toBe('Sales Orders (Extended)');
      expect(soExt?.exportOnly).toBe(true);
      expect(soExt?.columns).toContain('customer_name');
      expect(soExt?.columns).toContain('fulfillment_location_name');

      // Base table should have exportOnly: false
      const custBase = metadata.find((m) => m.id === 'customers');
      expect(custBase?.exportOnly).toBe(false);
    });
  });

  describe('Customers Extended Export', () => {
    it('should export customers with joined actor and customer group data', async () => {
      // 1. Seed customer group
      const [cg] = await pg.db
        .insert(customerGroups)
        .values({
          groupCode: 'VIP',
          name: 'VIP Wholesale',
          stateCode: CUSTOMER_STATE.ACTIVE,
          isOnCreditHold: false,
        })
        .returning();

      // 2. Seed organization
      const [org] = await pg.db
        .insert(organizations)
        .values({
          name: 'Acme Industries',
          stateCode: ORGANIZATION_STATE.ACTIVE,
          isTaxRegistered: true,
          email: 'info@acme.com',
          telephone: '0299998888',
          industry: 'Manufacturing',
        })
        .returning();

      // 3. Seed customer linked to organization and group
      await pg.db.insert(customers).values({
        customerNumber: 'CUST-EXT-01',
        organizationId: org.organizationId,
        customerGroupId: cg.customerGroupId,
        stateCode: CUSTOMER_STATE.ACTIVE,
        currencyCode: 'AUD',
        source: 'manual',
      });

      // 4. Export
      const csvString = (await service.exportCsv(
        'customers_extended',
      )) as string;
      expect(typeof csvString).toBe('string');

      const records = parse(csvString, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });

      expect(records.length).toBe(1);
      const row = records[0];
      expect(row.customer_number).toBe('CUST-EXT-01');
      expect(row.customer_name).toBe('Acme Industries');
      expect(row.customer_group_code).toBe('VIP');
      expect(row.customer_group_name).toBe('VIP Wholesale');
      expect(row.email).toBe('info@acme.com');
      expect(row.telephone).toBe('0299998888');
      expect(row.industry).toBe('Manufacturing');
      expect(row.currency_code).toBe('AUD');
      expect(row.state_code).toBe(CUSTOMER_STATE.ACTIVE);
    });
  });

  describe('Suppliers Extended Export', () => {
    it('should export suppliers with joined actor and supplier group data', async () => {
      // 1. Seed supplier group
      const [sg] = await pg.db
        .insert(supplierGroups)
        .values({
          groupCode: 'RAW-MAT',
          name: 'Raw Materials',
          isPurchasingBlocked: false,
          isPaymentBlocked: false,
        })
        .returning();

      // 2. Seed organization
      const [org] = await pg.db
        .insert(organizations)
        .values({
          name: 'Global Metals Pty Ltd',
          stateCode: ORGANIZATION_STATE.ACTIVE,
          isTaxRegistered: true,
          email: 'orders@globalmetals.com',
          telephone: '0388887777',
          website: 'https://globalmetals.com',
        })
        .returning();

      // 3. Seed supplier
      await pg.db.insert(suppliers).values({
        vendorNumber: 'SUPP-EXT-01',
        organizationId: org.organizationId,
        supplierGroupId: sg.supplierGroupId,
        stateCode: SUPPLIER_STATE.ACTIVE,
        currencyCode: 'USD',
        isPurchasingBlocked: false,
        isPaymentBlocked: false,
        source: 'manual',
      });

      // 4. Export
      const csvString = (await service.exportCsv(
        'suppliers_extended',
      )) as string;
      const records = parse(csvString, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });

      expect(records.length).toBe(1);
      const row = records[0];
      expect(row.vendor_number).toBe('SUPP-EXT-01');
      expect(row.supplier_name).toBe('Global Metals Pty Ltd');
      expect(row.supplier_group_code).toBe('RAW-MAT');
      expect(row.supplier_group_name).toBe('Raw Materials');
      expect(row.email).toBe('orders@globalmetals.com');
      expect(row.currency_code).toBe('USD');
    });
  });

  describe('Products Extended Export', () => {
    it('should export products with joined product group and UOM details', async () => {
      // 1. Seed product group
      const [pgGroup] = await pg.db
        .insert(productGroups)
        .values({
          groupCode: 'WIDGETS',
          name: 'Industrial Widgets',
        })
        .returning();

      // 2. Seed UOM
      await pg.db.insert(uomDictionary).values({
        uomCode: 'BOX',
        description: 'Box of 100',
      });

      // 3. Seed product
      await pg.db.insert(products).values({
        productNumber: 'WIDGET-001',
        name: 'Heavy Duty Widget',
        productType: 'inventory',
        structureType: 'standard',
        productGroupId: pgGroup.productGroupId,
        baseUom: 'BOX',
        stateCode: PRODUCT_STATE.ACTIVE,
        source: 'manual',
      });

      // 4. Export
      const csvString = (await service.exportCsv(
        'products_extended',
      )) as string;
      const records = parse(csvString, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });

      expect(records.length).toBe(1);
      const row = records[0];
      expect(row.product_number).toBe('WIDGET-001');
      expect(row.name).toBe('Heavy Duty Widget');
      expect(row.product_group_code).toBe('WIDGETS');
      expect(row.product_group_name).toBe('Industrial Widgets');
      expect(row.base_uom).toBe('BOX');
      expect(row.base_uom_description).toBe('Box of 100');
    });
  });

  describe('Sales Orders Extended Export', () => {
    it('should export sales orders with customer and location names', async () => {
      // 1. Seed organization and customer
      const [org] = await pg.db
        .insert(organizations)
        .values({
          name: 'Apex Logistics',
          stateCode: ORGANIZATION_STATE.ACTIVE,
          isTaxRegistered: true,
        })
        .returning();

      const [cust] = await pg.db
        .insert(customers)
        .values({
          customerNumber: 'CUST-SO-01',
          organizationId: org.organizationId,
          stateCode: CUSTOMER_STATE.ACTIVE,
          currencyCode: 'AUD',
          source: 'manual',
        })
        .returning();

      // 2. Seed location
      const [loc] = await pg.db
        .insert(locations)
        .values({
          code: 'SYD-WH',
          name: 'Sydney Central Warehouse',
          source: 'manual',
        })
        .returning();

      // 3. Seed sales order
      await pg.db.insert(salesOrders).values({
        orderNumber: 'SO-2026-0001',
        customerId: cust.customerId,
        fulfillmentLocationId: loc.locationId,
        exchangeRate: '1.0000',
        discrepanciesAcknowledged: false,
        stateCode: SALES_ORDER_STATE.CONFIRMED,
        currencyCode: 'AUD',
        source: 'manual',
      });

      // 4. Export
      const csvString = (await service.exportCsv(
        'sales_orders_extended',
      )) as string;
      const records = parse(csvString, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });

      expect(records.length).toBe(1);
      const row = records[0];
      expect(row.order_number).toBe('SO-2026-0001');
      expect(row.customer_number).toBe('CUST-SO-01');
      expect(row.customer_name).toBe('Apex Logistics');
      expect(row.fulfillment_location_code).toBe('SYD-WH');
      expect(row.fulfillment_location_name).toBe('Sydney Central Warehouse');
      expect(row.state_code).toBe(SALES_ORDER_STATE.CONFIRMED);
    });
  });

  describe('Import Guard', () => {
    it('should reject CSV import execution for any extended projection view', async () => {
      const dummyFile = {
        buffer: Buffer.from('customer_number,customer_name\nCUST-1,Acme'),
        originalname: 'customers_extended.csv',
        mimetype: 'text/csv',
      } as Express.Multer.File;

      await expect(
        service.executeCsv('customers_extended', 'insert', dummyFile),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.executeCsv('customers_extended', 'insert', dummyFile),
      ).rejects.toThrow(
        'Extended views are export-only and cannot be imported directly',
      );
    });
  });

  describe('Options & Audit', () => {
    it('should record audit event when exporting projection', async () => {
      await service.exportCsv(
        'customers_extended',
        {},
        undefined,
        'test_admin',
      );

      const events = await pg.db.select().from(systemEvents);
      const exportEvent = events.find(
        (e) => e.eventType === 'csv_export_generated',
      );
      expect(exportEvent).toBeDefined();
      expect(exportEvent?.actor).toBe('test_admin');
      expect(exportEvent?.entityDisplayName).toBe(
        'CSV Export: Customers (Extended)',
      );
    });
  });
});
