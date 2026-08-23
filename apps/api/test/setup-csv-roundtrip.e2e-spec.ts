import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { JwtService } from '@nestjs/jwt';
import { DRIZZLE } from '../src/drizzle/drizzle.module';
import { users, customers, pipelineJobs } from '@herobm/db-schema';
import { eq } from 'drizzle-orm';
import { CUSTOMER_STATE } from '@herobm/shared';
import { parse } from 'csv-parse/sync';

describe('CSV Export & Import Round-Trip (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Drizzle database instance in test
  let db: any;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );
    await app.init();

    db = app.get(DRIZZLE);
    const [adminUser] = await db
      .select({ userId: users.userId })
      .from(users)
      .where(eq(users.username, 'admin'))
      .limit(1);

    const jwtService = app.get(JwtService);
    accessToken = jwtService.sign({
      sub: adminUser?.userId || '00000000-0000-0000-0000-000000000001',
      username: 'admin',
      role: 'admin',
      roles: ['admin'],
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('should export customers, allow editing, and re-import via upsert merge', async () => {
    // 1. Clean test records
    await db
      .delete(customers)
      .where(eq(customers.customerNumber, 'CUST-ROUNDTRIP-1'));
    await db
      .delete(customers)
      .where(eq(customers.customerNumber, 'CUST-ROUNDTRIP-2'));

    // 2. Seed initial customer record
    await db.insert(customers).values({
      customerNumber: 'CUST-ROUNDTRIP-1',
      stateCode: CUSTOMER_STATE.ACTIVE,
      currencyCode: 'AUD',
      notes: 'Initial notes before export',
      creditLimit: '1000.00',
      source: 'manual',
    });

    // 3. Export CSV from endpoint
    const exportRes = await request(app.getHttpServer())
      .get('/setup/export-csv/customers')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(exportRes.headers['content-type']).toContain('text/csv');
    const csvContent = exportRes.text;
    expect(csvContent).toBeDefined();

    // 4. Parse exported CSV
    const rows = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as Record<string, string>[];

    const targetRow = rows.find(
      (r) => r.customer_number === 'CUST-ROUNDTRIP-1',
    );
    expect(targetRow).toBeDefined();
    expect(targetRow?.notes).toBe('Initial notes before export');

    // 5. Modify existing record in CSV and add a second record
    const headers = Object.keys(rows[0]);
    targetRow!.notes = 'Updated via bulk CSV roundtrip!';
    targetRow!.credit_limit = '5000.00';

    const newRow: Record<string, string> = { ...targetRow };
    newRow.customer_id = ''; // let db assign or keep empty
    newRow.customer_number = 'CUST-ROUNDTRIP-2';
    newRow.notes = 'Created during roundtrip import';

    // Construct modified CSV payload
    const modifiedRows = [targetRow!, newRow];
    const csvLines = [
      headers.join(','),
      ...modifiedRows.map((row) =>
        headers.map((h) => `"${(row[h] || '').replace(/"/g, '""')}"`).join(','),
      ),
    ];
    const modifiedCsv = csvLines.join('\n');

    // 6. Execute CSV Import with Upsert strategy
    const importRes = await request(app.getHttpServer())
      .post('/setup/execute-csv')
      .set('Authorization', `Bearer ${accessToken}`)
      .field('tableName', 'customers')
      .field('strategy', 'upsert')
      .attach('file', Buffer.from(modifiedCsv, 'utf8'), 'customers_update.csv')
      .expect(201);

    expect(importRes.body.jobId).toBeDefined();
    const jobId = importRes.body.jobId;

    // 7. Poll until job finishes
    let isCompleted = false;
    for (let i = 0; i < 20; i++) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const [job] = await db
        .select()
        .from(pipelineJobs)
        .where(eq(pipelineJobs.jobId, jobId));
      if (job && (job.status === 'done' || job.status === 'completed')) {
        isCompleted = true;
        break;
      }
      if (job && job.status === 'failed') {
        throw new Error(`Import job failed: ${JSON.stringify(job.logsJson)}`);
      }
    }
    expect(isCompleted).toBe(true);

    // 8. Assert DB reflects the updated values and new row
    const [updatedCust] = await db
      .select()
      .from(customers)
      .where(eq(customers.customerNumber, 'CUST-ROUNDTRIP-1'));
    expect(updatedCust).toBeDefined();
    expect(updatedCust.notes).toBe('Updated via bulk CSV roundtrip!');
    expect(Number(updatedCust.creditLimit)).toBe(5000);

    const [createdCust] = await db
      .select()
      .from(customers)
      .where(eq(customers.customerNumber, 'CUST-ROUNDTRIP-2'));
    expect(createdCust).toBeDefined();
    expect(createdCust.notes).toBe('Created during roundtrip import');
  });
});
