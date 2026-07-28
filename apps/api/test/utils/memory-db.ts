import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as fs from 'fs';
import * as path from 'path';
import * as schema from '../../src/drizzle/schema';
import {
  seedCoaSettings,
  seedCoaAccounts,
  seedAccounts,
  runCoreSeeds,
} from '../../src/seeds/prod/core';
import { seedTestLocations } from './test-seed';

export async function createMemoryDb(opts?: { skipSeeds?: boolean }) {
  const client = new PGlite();

  await client.exec(`
    CREATE SCHEMA IF NOT EXISTS herobm_core;
  `);

  const migrationsDir = path.join(process.cwd(), 'migrations');
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort(); // Sorts alphabetically which handles 0000_, 0001_, etc.

  for (const file of files) {
    let sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    sql = sql.replace(/^\uFEFF/, ''); // Strip BOM if present

    // Drizzle uses --> statement-breakpoint to separate statements
    const statements = sql
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    try {
      for (const statement of statements) {
        await client.exec(statement);
      }
    } catch (e) {
      console.warn(`Migration failed on file ${file}: ${e.message}`);
      throw e;
    }
  }

  // Schema drift catch-up (missing in migrations but present in Drizzle schema)
  await client.exec(`
    ALTER TABLE "herobm_core"."sales_invoices" ADD COLUMN IF NOT EXISTS "outstanding_amount" numeric DEFAULT '0' NOT NULL;
    ALTER TABLE "herobm_core"."purchase_invoices" ADD COLUMN IF NOT EXISTS "outstanding_amount" numeric DEFAULT '0' NOT NULL;
    ALTER TABLE "herobm_core"."api_keys" ADD COLUMN IF NOT EXISTS "role" text DEFAULT 'system' NOT NULL;
    ALTER TABLE "herobm_core"."gl_settings" ADD COLUMN IF NOT EXISTS "default_discounts_received_account_id" uuid;
    ALTER TABLE "herobm_core"."payment_allocations" ADD COLUMN IF NOT EXISTS "discount_amount" numeric DEFAULT '0';
    ALTER TABLE "herobm_core"."supplier_groups" ADD COLUMN IF NOT EXISTS "early_payment_discount_days" integer;
    ALTER TABLE "herobm_core"."suppliers" ADD COLUMN IF NOT EXISTS "early_payment_discount_days" integer;
  `);

  // Run extensions (Views, triggers, etc)
  const extensionsSql = fs.readFileSync(
    path.join(process.cwd(), 'src/drizzle/extensions.sql'),
    'utf8',
  );
  await client.exec(extensionsSql);

  const db = drizzle(client, { schema });

  // Run the standard application seeds against the in-memory PGLite DB
  if (!opts?.skipSeeds) {
    await runCoreSeeds(db, false);
    // Testing-only extension to seed COA defaults, accounts, and locations
    await seedCoaAccounts(db, false);
    await seedCoaSettings(db, false);
    await seedTestLocations(db, false);
    await seedAccounts(db, false);
  }

  return { client, db };
}
