import { SeedDB } from '../run';
import { runProdSeeds } from '../prod';
import { seedCoaAccounts, seedCoaSettings } from '../prod/core';
import { wipeDatabase, seedMasterData, generateTransactions } from '../demo';

export async function runSimSeeds(db: SeedDB, dryRun = false) {
  try {
    console.log('--- Starting Simulator Seeds ---');
    await wipeDatabase(db);

    // 1. Run core foundational seeds
    await runProdSeeds(db, dryRun);
    await seedCoaAccounts(db, false, 'us_standard');
    await seedCoaSettings(db, false, 'us_standard');

    // 2. Seed Master Data & Base Simulation Transactions
    const data = await seedMasterData(db);
    await generateTransactions(db, data);

    console.log('\nSim Data Seeding Complete!');
  } catch (e) {
    console.error('Simulation Seeding failed:', e);
    throw e;
  }
}
