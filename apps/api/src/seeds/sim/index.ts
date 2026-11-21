import { generateTransactions, seedMasterData, wipeDatabase } from '../demo';
import { runProdSeeds } from '../prod';
import { seedCoaAccounts, seedCoaSettings } from '../prod/core';
import { SeedDB } from '../run';

export async function runSimSeeds(
  db: SeedDB,
  dryRun = false,
  coaRegion?: string,
) {
  try {
    const args = process.argv.slice(2);
    const coaArg = args.find((a) => a.startsWith('--coa='));
    const region = coaRegion || (coaArg ? coaArg.split('=')[1] : 'us_standard');

    console.log(`--- Starting Simulator Seeds (COA: ${region}) ---`);
    await wipeDatabase(db);

    // 1. Run core foundational seeds
    if (!process.env.HOME_CURRENCY) {
      process.env.HOME_CURRENCY = region === 'au_standard' ? 'AUD' : 'USD';
    }
    await runProdSeeds(db, dryRun);
    await seedCoaAccounts(db, false, region);
    await seedCoaSettings(db, false, region);

    // 2. Seed Master Data & Base Simulation Transactions
    const data = await seedMasterData(db, region);
    await generateTransactions(db, data);

    console.log('\nSim Data Seeding Complete!');
  } catch (e) {
    console.error('Simulation Seeding failed:', e);
    throw e;
  }
}
