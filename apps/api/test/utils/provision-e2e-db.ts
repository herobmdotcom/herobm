/**
 * E2E Database Provisioner
 *
 * Creates a dedicated ephemeral database for E2E testing so that the
 * main dev instance is never polluted. Run before the E2E Jest suite.
 *
 * Flow:
 *   1. Connect to Postgres as superuser (uses the default POSTGRES_* env vars).
 *   2. DROP / CREATE a fresh database named `herobm_e2e_test`.
 *   3. Run all SQL migrations from apps/api/migrations/ against it.
 *   4. Run the standard application seeds (users, COA, locations, etc.).
 *   5. Print the connection details so the caller can export them.
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load environment from monorepo root .env
const rootEnv = path.resolve(__dirname, '..', '..', '..', '..', '.env');
dotenv.config({ path: rootEnv });

import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from '../../src/drizzle/herobm-core-schema';
import {
  runStandardSeeds,
  seedCoaSettings,
  seedCoaAccounts,
  seedAccounts,
} from '../../src/scripts/seed';
import { seedTestLocations, seedTestUsers } from './test-seed';

const E2E_DB_NAME = 'herobm_e2e_test';

async function provision() {
  const host = process.env.POSTGRES_HOST || 'localhost';
  const port = Number(process.env.POSTGRES_PORT || 5432);
  const user = process.env.POSTGRES_USER || 'postgres';
  const password = process.env.POSTGRES_PASSWORD;

  if (!password) {
    console.error(
      'POSTGRES_PASSWORD is not set. Cannot provision E2E database.',
    );
    process.exit(1);
  }

  // 1. Connect to the default 'postgres' database to issue CREATE/DROP
  const adminSql = postgres({
    host,
    port,
    user,
    password,
    database: 'postgres',
    max: 1,
  });

  console.log(`[E2E DB] Provisioning database "${E2E_DB_NAME}"...`);

  try {
    // Terminate existing connections to the test DB
    await adminSql`
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = ${E2E_DB_NAME} AND pid <> pg_backend_pid()
    `;
    await adminSql.unsafe(`DROP DATABASE IF EXISTS "${E2E_DB_NAME}"`);
    await adminSql.unsafe(`CREATE DATABASE "${E2E_DB_NAME}"`);
    console.log(`[E2E DB] Database "${E2E_DB_NAME}" created.`);
  } finally {
    await adminSql.end();
  }

  // 2. Connect to the new E2E database and run migrations
  const e2eSql = postgres({
    host,
    port,
    user,
    password,
    database: E2E_DB_NAME,
  });

  try {
    // Create schema
    await e2eSql`CREATE SCHEMA IF NOT EXISTS herobm_core`;

    // Run migration files in order
    const migrationsDir = path.join(__dirname, '..', '..', 'migrations');
    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      let sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      sql = sql.replace(/^\uFEFF/, ''); // strip BOM
      try {
        await e2eSql.unsafe(sql);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (e: any) {
        console.warn(`  Migration warning on ${file}: ${e.message}`);
      }
    }
    console.log(`[E2E DB] ${files.length} migrations applied.`);

    // Schema drift catch-up (in Drizzle schema but not yet in a migration file)
    await e2eSql.unsafe(`
      ALTER TABLE "herobm_core"."sales_invoices"
        ADD COLUMN IF NOT EXISTS "outstanding_amount" numeric DEFAULT '0' NOT NULL;
      ALTER TABLE "herobm_core"."purchase_invoices"
        ADD COLUMN IF NOT EXISTS "outstanding_amount" numeric DEFAULT '0' NOT NULL;
    `);

    // Apply extensions if present
    const extensionsFile = path.join(
      __dirname,
      '..',
      '..',
      'src',
      'drizzle',
      'extensions.sql',
    );
    if (fs.existsSync(extensionsFile)) {
      let extSql = fs.readFileSync(extensionsFile, 'utf8');
      extSql = extSql.replace(/^\uFEFF/, '');
      try {
        await e2eSql.unsafe(extSql);
        console.log('[E2E DB] Extensions applied.');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (e: any) {
        console.warn(`  Extensions warning: ${e.message}`);
      }
    }

    // 3. Seed the database
    const db = drizzle(e2eSql, { schema });
    await runStandardSeeds(db);
    // Testing-only extension to seed COA defaults, accounts, and locations for E2E
    await seedCoaAccounts(db, false);
    await seedCoaSettings(db, false);
    await seedTestLocations(db, false);
    await seedTestUsers(db, false);
    await seedAccounts(db, false);
    console.log('[E2E DB] Seeds applied.');
  } finally {
    await e2eSql.end();
  }

  console.log(
    `[E2E DB] Ready. Set POSTGRES_DB=${E2E_DB_NAME} for the test run.`,
  );
}

provision().catch((err) => {
  console.error('[E2E DB] Provisioning failed:', err);
  process.exit(1);
});
