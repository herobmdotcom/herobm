import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { GlService } from '../../gl/gl.service';
import { DRIZZLE } from '../../drizzle/drizzle.module';
import { glAccounts } from '../../drizzle/herobm-core-schema';
import { eq, sql } from 'drizzle-orm';

import type { SeedDB } from '../run';

export async function runTestSeeds(db: SeedDB, dryRun = false) {
  if (dryRun) {
    console.log('  [DRY RUN] Would seed test data');
    return;
  }
  const app = await NestFactory.createApplicationContext(AppModule);
  const appDb = app.get(DRIZZLE);
  const glService = app.get(GlService);

  const bankAccs = await appDb
    .select()
    .from(glAccounts)
    .where(eq(glAccounts.isBankAccount, true))
    .limit(1);
  if (!bankAccs.length) {
    console.error('No bank account found');
    process.exit(1);
  }
  const bankAcc = bankAccs[0];

  const arAccs = await appDb
    .select()
    .from(glAccounts)
    .where(sql`name ILIKE '%Receivable%'`)
    .limit(1);
  const apAccs = await appDb
    .select()
    .from(glAccounts)
    .where(sql`name ILIKE '%Payable%'`)
    .limit(1);

  const arCode = arAccs.length ? arAccs[0].accountCode : '1200';
  const apCode = apAccs.length ? apAccs[0].accountCode : '2000';

  console.log(`Using Bank Account: ${bankAcc.accountCode} - ${bankAcc.name}`);

  // Create Customer Payment
  await glService.postJournalEntry(
    [
      {
        accountCode: bankAcc.accountCode,
        debit: 500.0,
        credit: 0,
        memo: 'CUSTOMER PAYMENT INV-001',
      },
      {
        accountCode: arCode,
        debit: 0,
        credit: 500.0,
        memo: 'CUSTOMER PAYMENT INV-001',
      },
    ],
    {
      sourceType: 'manual',
      memo: 'Test Customer Payment',
      entryDate: '2026-05-27',
      actor: 'system',
    },
  );

  // Create Supplier Payment
  await glService.postJournalEntry(
    [
      {
        accountCode: apCode,
        debit: 200.0,
        credit: 0,
        memo: 'SUPPLIER PAYMENT BILL-001',
      },
      {
        accountCode: bankAcc.accountCode,
        debit: 0,
        credit: 200.0,
        memo: 'SUPPLIER PAYMENT BILL-001',
      },
    ],
    {
      sourceType: 'manual',
      memo: 'Test Supplier Payment',
      entryDate: '2026-05-28',
      actor: 'system',
    },
  );

  console.log('Payments seeded successfully.');
  await app.close();
}
