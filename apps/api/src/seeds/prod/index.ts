import { SeedDB } from '../run';
import { runCoreSeeds } from './core';
import { seedBusinessReports } from './business-reports';
import { seedDynamicReports } from './dynamic-reports';

export async function runProdSeeds(db: SeedDB, dryRun: boolean) {
  console.log('--- Starting Production Seeds ---');

  // 1. Run core foundational seeds
  await runCoreSeeds(db, dryRun);

  // 2. Run analytical business reports
  await seedBusinessReports(db, dryRun);

  // 3. Run dynamic reports
  // NOTE: This was previously in the codebase but unwired from default 'npm run seed'.
  // Per instructions to preserve exact existing logic, we leave this commented out for prod.
  // await seedDynamicReports(db, dryRun);

  console.log('--- Production Seeds Complete ---');
}
