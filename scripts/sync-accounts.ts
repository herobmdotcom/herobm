#!/usr/bin/env npx tsx
/**
 * sync-accounts.ts
 *
 * Imports ABM legacy customer records from public_marts.mart_accounts
 * into modbm_core.accounts via idempotent upserts on source_id.
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/sync-accounts.ts
 */

import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql, eq } from 'drizzle-orm';
import * as martsSchema from '../apps/api/src/drizzle/schema';
import * as coreSchema from '../apps/api/src/drizzle/modbm-core-schema';

// ── Connect ─────────────────────────────────────────────────────────────────

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
}

const client = process.env.DATABASE_URL
  ? postgres(process.env.DATABASE_URL)
  : postgres({
      host: process.env.POSTGRES_HOST ?? 'localhost',
      port: Number(process.env.POSTGRES_PORT ?? 5432),
      user: requireEnv('POSTGRES_USER'),
      password: requireEnv('POSTGRES_PASSWORD'),
      database: process.env.POSTGRES_DB ?? 'custom_app',
    });

const schema = { ...martsSchema, ...coreSchema };
const db = drizzle(client, { schema });

// ── Normalization ───────────────────────────────────────────────────────────

function normalizeStateCode(raw: string | null | undefined): string {
  if (!raw || raw.trim() === '') return 'active';
  const code = raw.trim().toUpperCase();
  if (code === 'A') return 'active';
  if (code === 'S' || code === 'H') return 'on_hold';
  return 'active';
}

function resolvePriceTier(priceScale: number | null | undefined): string | null {
  switch (priceScale) {
    case 1: return 'list';
    case 2: return 'trade';
    case 3: return 'level_3';
    case 4: return 'level_4';
    default: return null;
  }
}

function emptyToNull(val: string | null | undefined): string | null {
  if (!val) return null;
  const trimmed = val.trim();
  return trimmed === '' ? null : trimmed;
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  ModBM Account Import (ABM → modbm_core)');
  console.log('═══════════════════════════════════════════════════════════');

  // 1. Read all mart accounts
  const martRows = await db.select().from(martsSchema.accounts);
  console.log(`\n  Found ${martRows.length} ABM accounts in public_marts.mart_accounts`);

  if (martRows.length === 0) {
    console.log('  Nothing to import.');
    await client.end();
    return;
  }

  // 2. Check which sourceIds already exist in core
  const existingRows = await db
    .select({ sourceId: coreSchema.accounts.sourceId })
    .from(coreSchema.accounts)
    .where(sql`${coreSchema.accounts.sourceId} IS NOT NULL`);
  const existingSourceIds = new Set(existingRows.map((r) => r.sourceId));

  let inserted = 0;
  let updated = 0;

  for (const mart of martRows) {
    const sourceId = mart.accountId; // ABM's customer_id
    const isNew = !existingSourceIds.has(sourceId);

    const values = {
      accountNumber: mart.accountNumber || sourceId,
      name: mart.name || mart.accountNumber || sourceId,
      address1Line1: emptyToNull(mart.address1Line1),
      address1Line2: emptyToNull(mart.address1Line2),
      address1City: emptyToNull(mart.address1City),
      address1StateOrProvince: emptyToNull(mart.address1StateOrProvince),
      address1PostalCode: emptyToNull(mart.address1PostalCode),
      address1Country: emptyToNull(mart.address1Country),
      telephone1: emptyToNull(mart.telephone1),
      fax: emptyToNull(mart.fax),
      emailAddress1: emptyToNull(mart.emailAddress1),
      primaryContactName: emptyToNull(mart.primaryContactName),
      primaryContactEmail: emptyToNull(mart.primaryContactEmail),
      primaryContactPhone: emptyToNull(mart.primaryContactPhone),
      customerGroup: emptyToNull(mart.customerGroup),
      stateCode: normalizeStateCode(mart.stateCode),
      gstPosition: emptyToNull(mart.gstPosition),
      currencyCode: mart.currencyCode || 'EUR',
      customerDiscount: String(mart.customerDiscount ?? '0'),
      priceTier: resolvePriceTier(mart.priceScale),
      sourceId,
      source: 'abm' as const,
      createdBy: 'abm-import',
      createdOn: mart.createdOn ?? new Date(),
      modifiedOn: new Date(),
    };

    // 3. Upsert: insert or update on source_id conflict
    await db
      .insert(coreSchema.accounts)
      .values(values)
      .onConflictDoUpdate({
        target: coreSchema.accounts.sourceId,
        set: {
          name: values.name,
          address1Line1: values.address1Line1,
          address1Line2: values.address1Line2,
          address1City: values.address1City,
          address1StateOrProvince: values.address1StateOrProvince,
          address1PostalCode: values.address1PostalCode,
          address1Country: values.address1Country,
          telephone1: values.telephone1,
          fax: values.fax,
          emailAddress1: values.emailAddress1,
          primaryContactName: values.primaryContactName,
          primaryContactEmail: values.primaryContactEmail,
          primaryContactPhone: values.primaryContactPhone,
          customerGroup: values.customerGroup,
          stateCode: values.stateCode,
          gstPosition: values.gstPosition,
          currencyCode: values.currencyCode,
          customerDiscount: values.customerDiscount,
          priceTier: values.priceTier,
          modifiedOn: values.modifiedOn,
        },
      });

    // 4. If newly inserted, write an activity event
    if (isNew) {
      // Fetch the generated UUID
      const [row] = await db
        .select({ accountId: coreSchema.accounts.accountId })
        .from(coreSchema.accounts)
        .where(eq(coreSchema.accounts.sourceId, sourceId))
        .limit(1);

      if (row) {
        await db.insert(coreSchema.accountEvents).values({
          accountId: row.accountId,
          eventType: 'imported',
          payload: {
            source: 'abm',
            sourceId,
            importedAt: new Date().toISOString(),
          },
          actor: 'abm-import',
        });
      }
      inserted++;
    } else {
      updated++;
    }
  }

  console.log(`\n  ✓ Import complete:`);
  console.log(`    New:     ${inserted}`);
  console.log(`    Updated: ${updated}`);
  console.log(`    Total:   ${martRows.length}`);

  await client.end();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
