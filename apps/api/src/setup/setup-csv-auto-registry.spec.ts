import { Test, TestingModule } from '@nestjs/testing';
import { SetupService } from './setup.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { setupPgliteSuite } from '../test-utils/pglite-suite';
import { AppConfigService } from '../settings/app-config.service';
import { organizations, systemEvents } from '@herobm/db-schema';
import { parse } from 'csv-parse/sync';
import { ORGANIZATION_STATE } from '@herobm/shared';

describe('SetupService - Automatic CSV Registry (Unit)', () => {
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

    await pg.db.delete(organizations);
    await pg.db.delete(systemEvents);
  });

  it('should automatically register all core domain tables (> 50 tables)', async () => {
    const metadata = await service.getCsvMetadata();

    // Must be significantly more than the legacy hardcoded 25 tables
    expect(metadata.length).toBeGreaterThan(45);

    const tableIds = metadata.map((m) => m.id);

    // Core missing entities must now be present
    expect(tableIds).toContain('organizations');
    expect(tableIds).toContain('contacts');
    expect(tableIds).toContain('trading_terms');
    expect(tableIds).toContain('customer_delivery_addresses');
    expect(tableIds).toContain('tax_categories');
    expect(tableIds).toContain('tax_positions');
    expect(tableIds).toContain('gl_accounts');
    expect(tableIds).toContain('cost_centers');
    expect(tableIds).toContain('activities');
    expect(tableIds).toContain('sales_invoices');
    expect(tableIds).toContain('purchase_invoices');
    expect(tableIds).toContain('goods_received');
    expect(tableIds).toContain('work_orders');
    expect(tableIds).toContain('opportunities');
    expect(tableIds).toContain('bin_contents');
  });

  it('should include organizations table with correct metadata and columns', async () => {
    const metadata = await service.getCsvMetadata();
    const orgMeta = metadata.find((m) => m.id === 'organizations');

    expect(orgMeta).toBeDefined();
    expect(orgMeta?.name).toBe('Organizations');
    expect(orgMeta?.uniqueKey).toBe('organization_id');

    // Clean column names without asterisk
    const colNames = orgMeta?.columns.map((c) => c.replace(/\*$/, '')) || [];
    expect(colNames).toContain('organization_id');
    expect(colNames).toContain('name');
    expect(colNames).toContain('state_code');
    expect(colNames).toContain('is_tax_registered');
    expect(colNames).toContain('headquarters_city');
    expect(colNames).toContain('headquarters_country');

    // Audit columns must be excluded
    expect(colNames).not.toContain('created_by');
    expect(colNames).not.toContain('created_on');
    expect(colNames).not.toContain('modified_on');
    expect(colNames).not.toContain('updated_on');
  });

  it('should ensure every registered table has a valid uniqueKey existing in its columns', async () => {
    const metadata = await service.getCsvMetadata();

    for (const tableMeta of metadata) {
      expect(tableMeta.uniqueKey).toBeDefined();
      expect(tableMeta.uniqueKey.length).toBeGreaterThan(0);

      const rawCols = tableMeta.columns.map((c) => c.replace(/\*$/, ''));
      expect(rawCols).toContain(tableMeta.uniqueKey);
    }
  });

  it('should correct the 6 previously mismatched table keys', async () => {
    const metadata = await service.getCsvMetadata();

    const products = metadata.find((m) => m.id === 'products')!;
    expect(products.uniqueKey).toBe('product_number');

    const suppliers = metadata.find((m) => m.id === 'suppliers')!;
    expect(suppliers.uniqueKey).toBe('vendor_number');

    const customerGroups = metadata.find((m) => m.id === 'customer_groups')!;
    expect(customerGroups.uniqueKey).toBe('group_code');

    const supplierGroups = metadata.find((m) => m.id === 'supplier_groups')!;
    expect(supplierGroups.uniqueKey).toBe('group_code');

    const productGroups = metadata.find((m) => m.id === 'product_groups')!;
    expect(productGroups.uniqueKey).toBe('group_code');

    const bins = metadata.find((m) => m.id === 'bins')!;
    expect(bins.uniqueKey).toBe('bin_id');
  });

  it('should strictly exclude internal queues, security credentials, singletons, and audit logs', async () => {
    const metadata = await service.getCsvMetadata();
    const tableIds = metadata.map((m) => m.id);

    // Queues / internal state
    expect(tableIds).not.toContain('_pipeline_jobs');
    expect(tableIds).not.toContain('outbox');
    expect(tableIds).not.toContain('email_outbox');

    // Security & credentials
    expect(tableIds).not.toContain('user_two_factor');
    expect(tableIds).not.toContain('api_keys');
    expect(tableIds).not.toContain('casbin_rule');
    expect(tableIds).not.toContain('users');

    // Singletons
    expect(tableIds).not.toContain('app_settings');
    expect(tableIds).not.toContain('gl_settings');
    expect(tableIds).not.toContain('tenant_settings');

    // Event logs
    const eventTables = tableIds.filter((id) => id.endsWith('_events'));
    expect(eventTables).toHaveLength(0);
  });

  it('should successfully export organizations as CSV', async () => {
    // 1. Seed an organization record
    await pg.db.insert(organizations).values({
      name: 'Acme Industrial Supplies Pty Ltd',
      stateCode: ORGANIZATION_STATE.ACTIVE,
      isTaxRegistered: true,
      legalStatus: 'Pty Ltd',
      headquartersCity: 'Sydney',
      headquartersCountry: 'Australia',
      website: 'https://acme-supplies.example.com',
    });

    // 2. Export CSV
    const csvString = (await service.exportCsv('organizations')) as string;
    expect(typeof csvString).toBe('string');

    // 3. Parse CSV
    const records = parse(csvString, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as Record<string, string>[];

    expect(records.length).toBe(1);
    expect(records[0].name).toBe('Acme Industrial Supplies Pty Ltd');
    expect(records[0].headquarters_city).toBe('Sydney');
    expect(records[0].headquarters_country).toBe('Australia');
    expect(records[0].is_tax_registered).toBe('true');

    // 4. Verify headers match getCsvMetadata
    const metadata = await service.getCsvMetadata();
    const orgMeta = metadata.find((m) => m.id === 'organizations')!;
    const expectedHeaders = orgMeta.columns.map((c) => c.replace(/\*$/, ''));
    expect(Object.keys(records[0])).toEqual(expectedHeaders);
  });
});
