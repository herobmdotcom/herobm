import { beforeAll, beforeEach, afterEach, afterAll } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import { createMemoryDb } from '../../test/utils/memory-db';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '../drizzle/schema';

export interface PgliteTestContext {
  readonly db: DrizzleDB;
  readonly client: PGlite;
}

// --------------------------------------------------------------------------
// Transactional tables that hold test-produced data and must be cleared
// between tests. Reference/seed tables (uom_dictionary, tax_categories,
// gl_accounts, locations, zones, bins, users, etc.) are left intact.
// Order matters — children before parents to respect FK constraints.
// --------------------------------------------------------------------------
const TRANSACTIONAL_TABLES = [
  'herobm_core.gl_journal_lines',
  'herobm_core.gl_journal_entries',
  'herobm_core.sales_invoice_lines',
  'herobm_core.sales_invoices',
  'herobm_core.purchase_invoice_lines',
  'herobm_core.purchase_invoices',
  'herobm_core.sales_order_return_lines',
  'herobm_core.sales_order_returns',
  'herobm_core.sales_order_picks',
  'herobm_core.sales_order_shipment_lines',
  'herobm_core.sales_order_shipments',
  'herobm_core.user_events',
  'herobm_core.sales_events',
  'herobm_core.procurement_events',
  'herobm_core.warehouse_events',
  'herobm_core.master_data_events',
  'herobm_core.financial_events',
  'herobm_core.inventory_events',
  'herobm_core.system_events',
  'herobm_core.business_report_events',
  'herobm_core.email_events',
  'herobm_core.integration_events',
  'herobm_core.reconciliation_events',
  'herobm_core.group_events',
  'herobm_core.backorders',
  'herobm_core.outbox',
  'herobm_core.sales_order_lines',
  'herobm_core.sales_orders',
  'herobm_core.purchase_order_return_lines',
  'herobm_core.purchase_order_returns',
  'herobm_core.goods_received_lines',
  'herobm_core.goods_received',
  'herobm_core.purchase_order_lines',
  'herobm_core.purchase_orders',
  'herobm_core.inventory_ledger',
  'herobm_core.customers',
  'herobm_core.suppliers',
  'herobm_core.products',
  'herobm_core.payment_allocations',
  'herobm_core.payment_entries',
];

/**
 * Reusable utility for PGLite testing in NestJS services.
 *
 * Performance strategy: boot PGlite **once** per suite (in beforeAll)
 * from the pre-built snapshot. Between tests, truncate only the
 * transactional tables while keeping seed/reference data intact.
 *
 * This avoids the ~500ms cost of loading a snapshot for each of the
 * 488 test cases — cutting overall suite time roughly in half.
 *
 * For suites with `skipSeeds: true`, the old per-test snapshot reload
 * is used since those suites insert their own reference data.
 */
export function setupPgliteSuite(opts?: {
  skipSeeds?: boolean;
}): PgliteTestContext {
  if (typeof jest !== 'undefined') {
    jest.setTimeout(30000);
  }
  const context = {
    _db: null as DrizzleDB | null,
    _client: null as PGlite | null,
    get db() {
      if (!this._db)
        throw new Error('PGLite context.db accessed before it is initialized');
      return this._db;
    },
    get client() {
      if (!this._client)
        throw new Error(
          'PGLite context.client accessed before it is initialized',
        );
      return this._client;
    },
  };

  // Suites that skip seeds need fresh DBs per-test since they insert
  // their own reference data (uom_dictionary, tax_categories, etc.)
  if (opts?.skipSeeds) {
    let suiteSnapshot: Blob;

    beforeAll(async () => {
      const memory = await createMemoryDb(opts);
      suiteSnapshot = await memory.client.dumpDataDir();
      await memory.client.close();
    });

    beforeEach(async () => {
      const client = new PGlite({ loadDataDir: suiteSnapshot });
      await client.waitReady;
      const db = drizzle(client, { schema });
      context._db = db as unknown as DrizzleDB;
      context._client = client;
    });

    afterEach(async () => {
      if (context._client) {
        await context._client.close();
      }
      context._db = null;
      context._client = null;
    });

    return context as unknown as PgliteTestContext;
  }

  // Standard path: boot once, truncate transactional tables between tests
  beforeAll(async () => {
    const snapshotPath = path.join(process.cwd(), '.pglite-snapshot.bin');
    if (!fs.existsSync(snapshotPath)) {
      throw new Error(
        'PGlite snapshot not found. Did you forget to run generate-snapshot.ts?',
      );
    }
    const buffer = fs.readFileSync(snapshotPath);
    const snapshot = new File([buffer], 'snapshot.tar');
    const client = new PGlite({ loadDataDir: snapshot });
    await client.waitReady;
    const db = drizzle(client, { schema });
    context._db = db as unknown as DrizzleDB;
    context._client = client;
  });

  afterEach(async () => {
    // Truncate transactional tables to restore seed-only state.
    // Using CASCADE handles any FK dependencies we may have missed.
    try {
      // Force-close any lingering transaction that might be causing deadlocks
      try {
        await context._client!.exec('ROLLBACK');
      } catch {
        // Ignore if no transaction is active
      }

      await context._client!.exec(
        `TRUNCATE ${TRANSACTIONAL_TABLES.join(', ')} CASCADE`,
      );
    } catch (e: unknown) {
      // Fallback: truncate tables one-by-one if the batch fails
      for (const table of TRANSACTIONAL_TABLES) {
        try {
          await context._client!.exec(`TRUNCATE ${table} CASCADE`);
        } catch {
          // Table may not exist — skip
        }
      }
    }

    // Drop any test-created constraints (atomicity tests add CHECK
    // constraints like 'fail_audit', 'fail_on_test' that would
    // persist across tests in the shared PGlite instance).
    for (const [table, constraint] of [
      ['herobm_core.order_events', 'fail_audit'],
      ['herobm_core.account_events', 'fail_on_test'],
    ]) {
      try {
        await context._client!.exec(
          `ALTER TABLE ${table} DROP CONSTRAINT IF EXISTS ${constraint}`,
        );
      } catch {
        // Constraint doesn't exist — safe to ignore
      }
    }
  });

  afterAll(async () => {
    if (context._client!) {
      await context._client.close();
    }
    context._db = null;
    context._client = null;
  });

  return context as unknown as PgliteTestContext;
}
