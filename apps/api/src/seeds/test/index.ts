import {
  BIN_TYPE,
  SUPPLIER_STATE,
  CUSTOMER_STATE,
  PRODUCT_STATE,
} from '@herobm/shared';
import {
  glAccounts,
  locations,
  zones,
  bins,
  suppliers,
  customers,
  actors,
  products,
  taxCategories,
  tradingTerms,
  uomDictionary,
  glJournalEntries,
  glJournalLines,
} from '@herobm/db-schema';
import { eq, sql } from 'drizzle-orm';
import { seedCoaAccounts, seedCoaSettings } from '../prod/core';

import type { SeedDB } from '../run';

export async function runTestSeeds(db: SeedDB, dryRun = false) {
  if (dryRun) {
    console.log('  [DRY RUN] Would seed test data');
    return;
  }

  console.log('Seeding baseline test data...');

  await seedCoaAccounts(db, dryRun, 'au_standard');
  await seedCoaSettings(db, dryRun, 'au_standard');

  const defaultTerm = await db
    .select()
    .from(tradingTerms)
    .where(sql`code = 'NET30'`)
    .limit(1);
  const termId = defaultTerm[0]?.tradingTermsId;

  // 1. Locations
  const locId = 'c9050d22-1b1e-4519-8664-d621b1db7b8c';
  const zoneId = '2cfb8c56-b08e-4a6c-a225-b873a1198c8c';
  const binId = '1fbd779b-ae7d-419b-ab29-4d6cbbf7cd46';

  await db
    .insert(locations)
    .values({
      locationId: locId,
      code: 'TEST-LOC',
      name: 'Test Location',
      addressLine1: '123 Test St',
      city: 'Test City',
      stateOrProvince: 'TX',
      postalCode: '12345',
      country: 'USA',
      source: 'app',
      createdBy: 'system',
    })
    .onConflictDoNothing();

  await db
    .insert(zones)
    .values({
      zoneId: zoneId,
      locationId: locId,
      code: 'TEST-ZONE',
      name: 'Test Zone',
      source: 'app',
      createdBy: 'system',
    })
    .onConflictDoNothing();

  await db
    .insert(bins)
    .values({
      binId: binId,
      zoneId: zoneId,
      binNumber: 'TEST-BIN',
      binType: BIN_TYPE.STORAGE,
      source: 'app',
      createdBy: 'system',
    })
    .onConflictDoNothing();

  const supActorId = 'b0b3e7ea-b7bd-425d-bb85-df0a28f804aa';
  await db
    .insert(actors)
    .values({
      actorId: supActorId,
      name: 'Test Supplier LLC',
      headquartersAddressLine1: 'USA',
      isTaxRegistered: false,
    })
    .onConflictDoNothing();

  const supId = 'c1c3e7ea-b7bd-425d-bb85-df0a28f804aa';
  await db
    .insert(suppliers)
    .values({
      vendorId: supId,
      actorId: supActorId,
      vendorNumber: 'TEST-SUP-01',
      currencyCode: sql<string>`COALESCE((SELECT base_currency FROM herobm_core.gl_settings LIMIT 1), 'EUR')`,
      tradingTermsId: termId ?? null,
      stateCode: SUPPLIER_STATE.ACTIVE,
      source: 'app',
      isPurchasingBlocked: false,
      createdBy: 'system',
    })
    .onConflictDoNothing();

  const custActorId = 'd32c4e85-d865-4f40-8abf-c4e89e47261d';
  await db
    .insert(actors)
    .values({
      actorId: custActorId,
      name: 'Test Customer Inc',
      headquartersAddressLine1: 'USA',
      isTaxRegistered: false,
    })
    .onConflictDoNothing();

  const custId = 'e42c4e85-d865-4f40-8abf-c4e89e47261d';
  await db
    .insert(customers)
    .values({
      customerId: custId,
      actorId: custActorId,
      customerNumber: 'TEST-CUST-01',
      currencyCode: sql<string>`COALESCE((SELECT base_currency FROM herobm_core.gl_settings LIMIT 1), 'EUR')`,
      tradingTermsId: termId ?? null,
      creditLimit: '10000.00',
      stateCode: CUSTOMER_STATE.ACTIVE,
      source: 'app',
      createdBy: 'system',
    })
    .onConflictDoNothing();

  // 4. Products
  await db
    .insert(uomDictionary)
    .values({ uomCode: 'BOX', description: 'Box' })
    .onConflictDoNothing();

  const prodId = 'e2cd8fba-813c-48c0-84c1-4b13a375494d';
  await db
    .insert(products)
    .values({
      productId: prodId,
      productNumber: 'TEST-PROD-01',
      name: 'Test Product 1',
      baseUom: 'EA',
      productType: 'inventory',
      stateCode: PRODUCT_STATE.ACTIVE,
      source: 'app',
      structureType: 'standard',
      createdBy: 'system',
    })
    .onConflictDoNothing();

  console.log('Baseline test master data seeded.');

  // 5. Existing payment GL seed
  const bankAccs = await db
    .select()
    .from(glAccounts)
    .where(eq(glAccounts.isBankAccount, true))
    .limit(1);

  if (!bankAccs.length) {
    console.warn('No bank account found, skipping payment seeds');
    return;
  }
  const bankAcc = bankAccs[0];

  const arAccs = await db
    .select()
    .from(glAccounts)
    .where(sql`name ILIKE '%Receivable%'`)
    .limit(1);
  const apAccs = await db
    .select()
    .from(glAccounts)
    .where(sql`name ILIKE '%Payable%'`)
    .limit(1);

  const arId = arAccs.length ? arAccs[0].glAccountId : bankAcc.glAccountId;
  const apId = apAccs.length ? apAccs[0].glAccountId : bankAcc.glAccountId;

  // Create Customer Payment
  const custJeId = '00000000-0000-0000-0000-000000000001';
  await db
    .insert(glJournalEntries)
    .values({
      journalEntryId: custJeId,
      entryNumber: 'JE-CUST-PAY-01',
      entryDate: '2026-05-27',
      sourceType: 'manual',
      memo: 'Test Customer Payment',
      createdBy: 'system',
      isReversed: false,
    })
    .onConflictDoNothing();

  await db
    .insert(glJournalLines)
    // @ts-expect-error test data
    .values([
      {
        journalEntryId: custJeId,
        glAccountId: bankAcc.glAccountId,
        debit: '500.00',
        credit: '0.00',
        memo: 'CUSTOMER PAYMENT INV-001',
        exchangeRate: '1',
        isReconciled: false,
        journalLineId: crypto.randomUUID(),
      },
      {
        journalEntryId: custJeId,
        glAccountId: arId,
        debit: '0.00',
        credit: '500.00',
        memo: 'CUSTOMER PAYMENT INV-001',
        exchangeRate: '1',
        isReconciled: false,
        journalLineId: crypto.randomUUID(),
      },
    ])
    .onConflictDoNothing();

  // Create Supplier Payment
  const supJeId = '00000000-0000-0000-0000-000000000002';
  await db
    .insert(glJournalEntries)
    .values({
      journalEntryId: supJeId,
      entryNumber: 'JE-SUP-PAY-01',
      entryDate: '2026-05-28',
      sourceType: 'manual',
      memo: 'Test Supplier Payment',
      createdBy: 'system',
      isReversed: false,
    })
    .onConflictDoNothing();

  await db
    .insert(glJournalLines)
    // @ts-expect-error test data
    .values([
      {
        journalEntryId: supJeId,
        glAccountId: apId,
        debit: '200.00',
        credit: '0.00',
        memo: 'SUPPLIER PAYMENT BILL-001',
        exchangeRate: '1',
        isReconciled: false,
        journalLineId: crypto.randomUUID(),
      },
      {
        journalEntryId: supJeId,
        glAccountId: bankAcc.glAccountId,
        debit: '0.00',
        credit: '200.00',
        memo: 'SUPPLIER PAYMENT BILL-001',
        exchangeRate: '1',
        isReconciled: false,
        journalLineId: crypto.randomUUID(),
      },
    ])
    .onConflictDoNothing();

  console.log('Payments seeded successfully.');
}
