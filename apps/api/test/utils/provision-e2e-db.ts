/**
 * E2E Database Provisioner (Accelerated with PostgreSQL Template DB)
 *
 * Creates a dedicated ephemeral database for E2E testing using a cached
 * PostgreSQL template database (`herobm_e2e_template`).
 *
 * Performance:
 *   - Cold (Template Build): ~15-20s (runs migrations & seeds once)
 *   - Warm (Template Clone): < 200ms (PostgreSQL copy-on-write clone)
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';

// Load environment from monorepo root .env
const rootEnv = path.resolve(__dirname, '..', '..', '..', '..', '.env');
dotenv.config({ path: rootEnv });

import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from '@herobm/db-schema';
import {
  runCoreSeeds,
  seedCoaAccounts,
  seedCoaSettings,
  seedAccounts,
} from '../../src/seeds/prod/core';
import { seedTestLocations, seedTestUsers } from './test-seed';

const TEMPLATE_DB_NAME = 'herobm_e2e_template';
const E2E_DB_NAME = 'herobm_e2e_test';

function getMigrationsFingerprint(): string {
  const migrationsDir = path.join(__dirname, '..', '..', 'migrations');
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  const hash = crypto.createHash('sha256');
  for (const file of files) {
    hash.update(file);
    const stat = fs.statSync(path.join(migrationsDir, file));
    hash.update(String(stat.mtimeMs));
    hash.update(String(stat.size));
  }
  return hash.digest('hex');
}

async function buildTemplateDb(
  adminSql: postgres.Sql,
  host: string,
  port: number,
  user: string,
  password?: string,
) {
  console.log(`[E2E DB] Building template database "${TEMPLATE_DB_NAME}"...`);

  // Terminate any existing connections to the template DB
  await adminSql`
    SELECT pg_terminate_backend(pid)
    FROM pg_stat_activity
    WHERE datname = ${TEMPLATE_DB_NAME} AND pid <> pg_backend_pid()
  `;
  await adminSql.unsafe(`DROP DATABASE IF EXISTS "${TEMPLATE_DB_NAME}"`);
  await adminSql.unsafe(`CREATE DATABASE "${TEMPLATE_DB_NAME}"`);

  const templateSql = postgres({
    host,
    port,
    user,
    password,
    database: TEMPLATE_DB_NAME,
  });

  try {
    // Create schema
    await templateSql`CREATE SCHEMA IF NOT EXISTS herobm_core`;

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
        await templateSql.unsafe(sql);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.warn(`  Migration warning on ${file}: ${message}`);
      }
    }
    console.log(`[E2E DB] ${files.length} migrations applied to template.`);

    // Schema drift catch-up
    await templateSql.unsafe(`
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
        await templateSql.unsafe(extSql);
        console.log('[E2E DB] Extensions applied to template.');
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.warn(`  Extensions warning: ${message}`);
      }
    }

    // Seed the database
    const db = drizzle(templateSql, { schema });
    await runCoreSeeds(db, false);
    await seedCoaAccounts(db, false);
    await seedCoaSettings(db, false);
    await seedTestLocations(db, false);
    await seedTestUsers(db, false);
    await seedAccounts(db, false);
    console.log('[E2E DB] Seeds applied to template.');

    // Save fingerprint in template metadata table
    const fingerprint = getMigrationsFingerprint();
    await templateSql`
      CREATE TABLE IF NOT EXISTS herobm_core._e2e_template_meta (
        key text PRIMARY KEY,
        value text NOT NULL
      );
    `;
    await templateSql`
      INSERT INTO herobm_core._e2e_template_meta (key, value)
      VALUES ('fingerprint', ${fingerprint})
      ON CONFLICT (key) DO UPDATE SET value = ${fingerprint};
    `;
  } finally {
    await templateSql.end();
  }

  console.log(
    `[E2E DB] Template database "${TEMPLATE_DB_NAME}" built successfully.`,
  );
}

async function isTemplateValid(
  adminSql: postgres.Sql,
  host: string,
  port: number,
  user: string,
  password?: string,
): Promise<boolean> {
  const [exists] = await adminSql`
    SELECT 1 FROM pg_database WHERE datname = ${TEMPLATE_DB_NAME}
  `;
  if (!exists) return false;

  const currentFingerprint = getMigrationsFingerprint();
  const templateSql = postgres({
    host,
    port,
    user,
    password,
    database: TEMPLATE_DB_NAME,
    max: 1,
    connect_timeout: 5,
  });

  try {
    const [row] = await templateSql`
      SELECT value FROM herobm_core._e2e_template_meta WHERE key = 'fingerprint'
    `;
    return row?.value === currentFingerprint;
  } catch {
    return false;
  } finally {
    await templateSql.end();
  }
}

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

  const startMs = Date.now();

  // 1. Connect to admin database
  const adminSql = postgres({
    host,
    port,
    user,
    password,
    database: 'postgres',
    max: 1,
  });

  try {
    const valid = await isTemplateValid(adminSql, host, port, user, password);
    if (!valid) {
      await buildTemplateDb(adminSql, host, port, user, password);
    } else {
      console.log(
        `[E2E DB] Using cached template database "${TEMPLATE_DB_NAME}".`,
      );
    }

    // 2. Clone template database into E2E_DB_NAME
    console.log(
      `[E2E DB] Fast-cloning "${TEMPLATE_DB_NAME}" to "${E2E_DB_NAME}"...`,
    );

    // Terminate any active connections to template and target
    await adminSql`
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname IN (${E2E_DB_NAME}, ${TEMPLATE_DB_NAME}) AND pid <> pg_backend_pid()
    `;

    await adminSql.unsafe(`DROP DATABASE IF EXISTS "${E2E_DB_NAME}"`);
    await adminSql.unsafe(
      `CREATE DATABASE "${E2E_DB_NAME}" TEMPLATE "${TEMPLATE_DB_NAME}"`,
    );

    const elapsed = Date.now() - startMs;
    console.log(
      `[E2E DB] Provisioned "${E2E_DB_NAME}" in ${elapsed}ms. Set POSTGRES_DB=${E2E_DB_NAME} for the test run.`,
    );
  } finally {
    await adminSql.end();
  }
}

provision().catch((err) => {
  console.error('[E2E DB] Provisioning failed:', err);
  process.exit(1);
});
