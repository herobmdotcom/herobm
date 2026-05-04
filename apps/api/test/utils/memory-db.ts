import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as fs from 'fs';
import * as path from 'path';
import * as schema from '../../src/drizzle/modbm-core-schema';
import { runStandardSeeds } from '../../src/scripts/seed';

export async function createMemoryDb() {
  const client = new PGlite();
  
  await client.exec(`
    CREATE SCHEMA IF NOT EXISTS modbm_core;
  `);

  const migrationsDir = path.join(process.cwd(), 'migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort(); // Sorts alphabetically which handles 0000_, 0001_, etc.

  for (const file of files) {
    let sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    sql = sql.replace(/^\uFEFF/, ''); // Strip BOM if present
    try {
      await client.exec(sql);
    } catch (e) {
      console.warn(`Migration failed on file ${file}: ${e.message}`);
    }
  }

  const db = drizzle(client, { schema });

  // Run the standard application seeds against the in-memory PGLite DB
  await runStandardSeeds(db);

  return { client, db };
}
