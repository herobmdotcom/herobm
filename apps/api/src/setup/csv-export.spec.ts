import { Test, TestingModule } from '@nestjs/testing';
import { SetupService } from './setup.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { setupPgliteSuite } from '../test-utils/pglite-suite';
import { AppConfigService } from '../settings/app-config.service';
import {
  customers,
  actors,
  customerGroups,
  systemEvents,
} from '@herobm/db-schema';
import { BadRequestException } from '@nestjs/common';
import { CUSTOMER_STATE } from '@herobm/shared';
import { parse } from 'csv-parse/sync';

describe('CSV Export Engine (Unit)', () => {
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

    // Clean tables
    await pg.db.delete(customers);
    await pg.db.delete(customerGroups);
    await pg.db.delete(actors);
    await pg.db.delete(systemEvents);
  });

  it('should export valid CSV with headers matching getCsvMetadata', async () => {
    // 1. Seed customer
    await pg.db.insert(customers).values({
      customerNumber: 'CUST-001',
      stateCode: CUSTOMER_STATE.ACTIVE,
      currencyCode: 'AUD',
      notes: 'Customer note with, comma and "quotes"',
      source: 'manual',
    });

    // 2. Export CSV
    const csvString = (await service.exportCsv('customers')) as string;
    expect(typeof csvString).toBe('string');

    // 3. Parse CSV
    const records = parse(csvString, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    expect(records.length).toBe(1);
    expect(records[0].customer_number).toBe('CUST-001');
    expect(records[0].currency_code).toBe('AUD');
    expect(records[0].state_code).toBe(CUSTOMER_STATE.ACTIVE);
    expect(records[0].notes).toBe('Customer note with, comma and "quotes"');

    // 4. Verify headers match metadata columns (excluding asterisks)
    const metadata = await service.getCsvMetadata();
    const customerMeta = metadata.find((m) => m.id === 'customers')!;
    const expectedHeaders = customerMeta.columns.map((c) =>
      c.replace(/\*$/, ''),
    );
    const actualHeaders = Object.keys(records[0]);

    expect(actualHeaders).toEqual(expectedHeaders);
  });

  it('should filter out archived records when includeArchived is false', async () => {
    await pg.db.insert(customers).values([
      {
        customerNumber: 'CUST-ACTIVE',
        stateCode: CUSTOMER_STATE.ACTIVE,
        currencyCode: 'AUD',
        source: 'manual',
      },
      {
        customerNumber: 'CUST-ARCHIVED',
        stateCode: CUSTOMER_STATE.ARCHIVED,
        currencyCode: 'AUD',
        source: 'manual',
      },
    ]);

    const activeCsv = (await service.exportCsv('customers', {
      includeArchived: false,
    })) as string;
    const activeRecords = parse(activeCsv, { columns: true });
    expect(activeRecords.length).toBe(1);
    expect(activeRecords[0].customer_number).toBe('CUST-ACTIVE');

    const allCsv = (await service.exportCsv('customers', {
      includeArchived: true,
    })) as string;
    const allRecords = parse(allCsv, { columns: true });
    expect(allRecords.length).toBe(2);
  });

  it('should respect the limit option', async () => {
    await pg.db.insert(customers).values([
      {
        customerNumber: 'CUST-1',
        stateCode: CUSTOMER_STATE.ACTIVE,
        currencyCode: 'AUD',
        source: 'manual',
      },
      {
        customerNumber: 'CUST-2',
        stateCode: CUSTOMER_STATE.ACTIVE,
        currencyCode: 'AUD',
        source: 'manual',
      },
      {
        customerNumber: 'CUST-3',
        stateCode: CUSTOMER_STATE.ACTIVE,
        currencyCode: 'AUD',
        source: 'manual',
      },
    ]);

    const csvString = (await service.exportCsv('customers', {
      limit: 2,
    })) as string;
    const records = parse(csvString, { columns: true });
    expect(records.length).toBe(2);
  });

  it('should emit an audit log event on CSV export', async () => {
    await pg.db.insert(customers).values({
      customerNumber: 'CUST-AUDIT',
      stateCode: CUSTOMER_STATE.ACTIVE,
      currencyCode: 'AUD',
      source: 'manual',
    });

    await service.exportCsv('customers', {}, undefined, 'admin_user');

    const events = await pg.db.select().from(systemEvents);
    expect(events.length).toBeGreaterThan(0);
    const exportEvent = events.find(
      (e) => e.eventType === 'csv_export_generated',
    );
    expect(exportEvent).toBeDefined();
    expect(exportEvent?.actor).toBe('admin_user');
    expect(exportEvent?.entityDisplayName).toContain('Customers');
  });

  it('should throw BadRequestException for unsupported table names', async () => {
    await expect(service.exportCsv('non_existent_table')).rejects.toThrow(
      BadRequestException,
    );
  });
});
