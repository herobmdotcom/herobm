import { TestingModule } from '@nestjs/testing';
import { createE2eModule } from './utils/e2e-module';
import { AppModule } from '../src/app.module';
import { DRIZZLE } from '../src/drizzle/drizzle.module';
import * as schema from '../src/drizzle/herobm-core-schema';
import { sql } from 'drizzle-orm';
import { INestApplication } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';

describe('Database Schema Integrity (e2e) - ADV-103', () => {
  let app: INestApplication;
  let db: NodePgDatabase<typeof schema>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await (
      await createE2eModule()
    ).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    db = app.get(DRIZZLE);
  });

  afterAll(async () => {
    await app.close();
  });

  it('should preserve schema defaults against unauthorized dropping by tools like dbt', async () => {
    // Check that sales_invoices still has its column defaults (e.g. DEFAULT now() for created_on)
    // If dbt ran with --full-refresh, these would have been wiped silently.

    const queryResult = await db.execute<{
      column_name: string;
      column_default: string | null;
    }>(
      sql`
        SELECT column_name, column_default 
        FROM information_schema.columns 
        WHERE table_schema = 'herobm_core' 
          AND table_name = 'sales_invoices' 
          AND column_name IN ('created_on', 'modified_on', 'outstanding_amount')
      `,
    );

    // In node-postgres via Drizzle, the rows are in the .rows property
    const rows = (queryResult as any).rows || queryResult;

    expect(rows.length).toBeGreaterThan(0);

    for (const row of rows) {
      if (row.column_name === 'created_on') {
        expect(row.column_default).not.toBeNull();
        expect(row.column_default).toMatch(/now\(\)|CURRENT_TIMESTAMP/i);
      }
      if (row.column_name === 'modified_on') {
        expect(row.column_default).not.toBeNull();
        expect(row.column_default).toMatch(/now\(\)|CURRENT_TIMESTAMP/i);
      }
      if (row.column_name === 'outstanding_amount') {
        expect(row.column_default).not.toBeNull();
      }
    }
  });
});
