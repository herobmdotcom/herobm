import { Test, TestingModule } from '@nestjs/testing';
import { SetupService } from './setup.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { setupPgliteSuite } from '../test-utils/pglite-suite';
import { AppConfigService } from '../settings/app-config.service';
import { customers, pipelineJobs, systemEvents } from '@herobm/db-schema';
import { BadRequestException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { CUSTOMER_STATE } from '@herobm/shared';

function createMockCsvFile(
  csvContent: string,
  filename = 'test.csv',
): Express.Multer.File {
  return {
    buffer: Buffer.from(csvContent, 'utf-8'),
    originalname: filename,
    mimetype: 'text/csv',
    fieldname: 'file',
    encoding: '7bit',
    size: Buffer.byteLength(csvContent, 'utf-8'),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Mock stream
    stream: null as any,
    destination: '',
    filename,
    path: '',
  };
}

describe('CSV Import Engine (Unit)', () => {
  const pg = setupPgliteSuite({ skipSeeds: true });
  let service: SetupService;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Generic DB instance in test
  async function waitForJob(jobId: string, maxMs = 5000): Promise<any> {
    const start = Date.now();
    while (Date.now() - start < maxMs) {
      const [job] = await pg.db
        .select()
        .from(pipelineJobs)
        .where(eq(pipelineJobs.jobId, jobId));
      if (
        job &&
        (job.status === 'done' ||
          job.status === 'completed' ||
          job.status === 'failed')
      ) {
        return job;
      }
      await new Promise((r) => setTimeout(r, 25));
    }
    throw new Error(`Job ${jobId} did not complete within ${maxMs}ms`);
  }

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
    await pg.db.delete(pipelineJobs);
    await pg.db.delete(systemEvents);
  });

  describe('Insert Strategy', () => {
    it('should successfully insert new records from CSV', async () => {
      const csv = [
        'customer_number,state_code,currency_code,notes,credit_limit,source',
        'CUST-INS-1,active,AUD,"First imported customer",1500.00,manual',
        'CUST-INS-2,active,AUD,"Second imported customer",2500.00,manual',
      ].join('\n');

      const file = createMockCsvFile(csv, 'customers_insert.csv');
      const { jobId } = await service.executeCsv('customers', 'insert', file);
      expect(jobId).toBeDefined();

      const job = await waitForJob(jobId);
      expect(job.status).toBe('done');

      const dbRecords = await pg.db
        .select()
        .from(customers)
        .where(eq(customers.source, 'manual'));

      expect(dbRecords.length).toBe(2);
      const c1 = dbRecords.find((c) => c.customerNumber === 'CUST-INS-1');
      expect(c1).toBeDefined();
      expect(c1?.notes).toBe('First imported customer');
      expect(Number(c1?.creditLimit)).toBe(1500);

      const c2 = dbRecords.find((c) => c.customerNumber === 'CUST-INS-2');
      expect(c2).toBeDefined();
      expect(c2?.notes).toBe('Second imported customer');
      expect(Number(c2?.creditLimit)).toBe(2500);
    });

    it('should fail with error when attempting to insert duplicate keys', async () => {
      // Pre-seed an existing customer
      await pg.db.insert(customers).values({
        customerNumber: 'CUST-INS-DUP',
        stateCode: CUSTOMER_STATE.ACTIVE,
        currencyCode: 'AUD',
        source: 'manual',
      });

      // Try inserting same customer number
      const csv = [
        'customer_number,state_code,currency_code,source',
        'CUST-INS-DUP,active,AUD,manual',
      ].join('\n');

      const file = createMockCsvFile(csv);
      const { jobId } = await service.executeCsv('customers', 'insert', file);

      const job = await waitForJob(jobId);
      expect(job.status).toBe('failed');
      expect(JSON.stringify(job.logsJson)).toContain(
        'FATAL: CSV Import failed',
      );
    });
  });

  describe('Upsert Strategy', () => {
    it('should update existing records and insert new records on unique key conflict', async () => {
      // Seed existing customer
      await pg.db.insert(customers).values({
        customerNumber: 'CUST-UP-1',
        stateCode: CUSTOMER_STATE.ACTIVE,
        currencyCode: 'AUD',
        notes: 'Original notes',
        creditLimit: '1000.00',
        source: 'manual',
      });

      // CSV contains update for CUST-UP-1 and new record CUST-UP-2
      const csv = [
        'customer_number,state_code,currency_code,notes,credit_limit,source',
        'CUST-UP-1,active,AUD,"Updated via upsert",5000.00,manual',
        'CUST-UP-2,active,AUD,"Brand new customer",3000.00,manual',
      ].join('\n');

      const file = createMockCsvFile(csv);
      const { jobId } = await service.executeCsv('customers', 'upsert', file);

      const job = await waitForJob(jobId);
      expect(job.status).toBe('done');

      // Verify CUST-UP-1 was updated
      const [updated] = await pg.db
        .select()
        .from(customers)
        .where(eq(customers.customerNumber, 'CUST-UP-1'));
      expect(updated).toBeDefined();
      expect(updated.notes).toBe('Updated via upsert');
      expect(Number(updated.creditLimit)).toBe(5000);

      // Verify CUST-UP-2 was inserted
      const [created] = await pg.db
        .select()
        .from(customers)
        .where(eq(customers.customerNumber, 'CUST-UP-2'));
      expect(created).toBeDefined();
      expect(created.notes).toBe('Brand new customer');
      expect(Number(created.creditLimit)).toBe(3000);
    });
  });

  describe('Ignore Strategy', () => {
    it('should skip conflicting records and keep original values untouched', async () => {
      // Seed existing customer
      await pg.db.insert(customers).values({
        customerNumber: 'CUST-IGN-1',
        stateCode: CUSTOMER_STATE.ACTIVE,
        currencyCode: 'AUD',
        notes: 'Original untouched notes',
        creditLimit: '1000.00',
        source: 'manual',
      });

      // CSV attempts to overwrite CUST-IGN-1 and insert CUST-IGN-2
      const csv = [
        'customer_number,state_code,currency_code,notes,credit_limit,source',
        'CUST-IGN-1,active,AUD,"Attempted overwrite notes",9999.00,manual',
        'CUST-IGN-2,active,AUD,"Inserted customer",2000.00,manual',
      ].join('\n');

      const file = createMockCsvFile(csv);
      const { jobId } = await service.executeCsv('customers', 'ignore', file);

      const job = await waitForJob(jobId);
      expect(job.status).toBe('done');

      // Verify CUST-IGN-1 was NOT modified
      const [untouched] = await pg.db
        .select()
        .from(customers)
        .where(eq(customers.customerNumber, 'CUST-IGN-1'));
      expect(untouched.notes).toBe('Original untouched notes');
      expect(Number(untouched.creditLimit)).toBe(1000);

      // Verify CUST-IGN-2 was inserted
      const [inserted] = await pg.db
        .select()
        .from(customers)
        .where(eq(customers.customerNumber, 'CUST-IGN-2'));
      expect(inserted).toBeDefined();
      expect(inserted.notes).toBe('Inserted customer');
    });
  });

  describe('Header & Data Sanitization', () => {
    it('should strip asterisks from required headers (e.g. customer_number*)', async () => {
      const csv = [
        'customer_number*,state_code*,currency_code*,source*',
        'CUST-AST-1,active,AUD,manual',
      ].join('\n');

      const file = createMockCsvFile(csv);
      const { jobId } = await service.executeCsv('customers', 'insert', file);

      const job = await waitForJob(jobId);
      expect(job.status).toBe('done');

      const [record] = await pg.db
        .select()
        .from(customers)
        .where(eq(customers.customerNumber, 'CUST-AST-1'));
      expect(record).toBeDefined();
    });

    it('should normalize 2-letter home currencies to 3-letter codes', async () => {
      const csv = [
        'customer_number,state_code,currency_code,source',
        'CUST-CURR-AU,active,AU,manual',
        'CUST-CURR-US,active,US,manual',
      ].join('\n');

      const file = createMockCsvFile(csv);
      const { jobId } = await service.executeCsv('customers', 'insert', file);

      const job = await waitForJob(jobId);
      expect(job.status).toBe('done');

      const [au] = await pg.db
        .select()
        .from(customers)
        .where(eq(customers.customerNumber, 'CUST-CURR-AU'));
      expect(au.currencyCode).toBe('AUD');

      const [us] = await pg.db
        .select()
        .from(customers)
        .where(eq(customers.customerNumber, 'CUST-CURR-US'));
      expect(us.currencyCode).toBe('USD');
    });

    it('should map empty string text fields to null', async () => {
      const csv = [
        'customer_number,state_code,currency_code,notes,price_tier,source',
        'CUST-EMPTY-1,active,AUD,"",,manual',
      ].join('\n');

      const file = createMockCsvFile(csv);
      const { jobId } = await service.executeCsv('customers', 'insert', file);

      const job = await waitForJob(jobId);
      expect(job.status).toBe('done');

      const [record] = await pg.db
        .select()
        .from(customers)
        .where(eq(customers.customerNumber, 'CUST-EMPTY-1'));
      expect(record.notes).toBeNull();
      expect(record.priceTier).toBeNull();
    });
  });

  describe('Validation & Edge Cases', () => {
    it('should reject unsupported table names with BadRequestException', async () => {
      const file = createMockCsvFile('col1,col2\nval1,val2');
      await expect(
        service.executeCsv('non_existent_table', 'insert', file),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject starting import when another job is actively running', async () => {
      // Pre-seed a running job
      await pg.db.insert(pipelineJobs).values({
        jobId: 'existing-running-job',
        type: 'csv',
        status: 'running',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const file = createMockCsvFile(
        'customer_number,state_code,currency_code,source\nC-1,active,AUD,manual',
      );
      await expect(
        service.executeCsv('customers', 'insert', file),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
