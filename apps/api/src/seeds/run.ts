import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as path from 'path';
import * as dotenv from 'dotenv';
import * as schema from '@herobm/db-schema';
import { PgDatabase } from 'drizzle-orm/pg-core';

// Load environment variables from the root .env file
dotenv.config({ path: path.resolve(__dirname, '../../../../' + (process.env.ENV_FILE || '.env')) });

// Define the common SeedDB type exported for all seed scripts
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Drizzle complex types
export type SeedDB = PgDatabase<any, typeof schema, any>;

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  let mode = 'prod';
  const modeArg = args.find((arg) => arg.startsWith('--mode='));
  if (modeArg) {
    mode = modeArg.split('=')[1];
  }

  // Setup standard database connection pool
  const host = process.env.POSTGRES_HOST || '127.0.0.1';
  const port = Number(process.env.POSTGRES_PORT) || 5432;
  const user = process.env.POSTGRES_USER || 'postgres';
  const password = process.env.POSTGRES_PASSWORD;
  const database = process.env.POSTGRES_DB || 'herobm';

  const pool = new Pool({
    host,
    port,
    user,
    password,
    database,
  });

  const db = drizzle(pool, { schema }) as SeedDB;

  try {
    if (mode === 'prod') {
      const { runProdSeeds } = await import('./prod/index.js');
      await runProdSeeds(db, dryRun);
    } else if (mode === 'demo') {
      const { runDemoSeeds } = await import('./demo/index.js');
      await runDemoSeeds(db, dryRun);
    } else if (mode === 'test') {
      const { runProdSeeds } = await import('./prod/index.js');
      await runProdSeeds(db, dryRun);

      const { runTestSeeds } = await import('./test/index.js');
      await runTestSeeds(db, dryRun);
    } else if (mode === 'sim') {
      const { runSimSeeds } = await import('./sim/index.js');
      await runSimSeeds(db, dryRun);
    } else {
      console.error(`Unknown mode: ${mode}`);
      process.exit(1);
    }
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main();
}
