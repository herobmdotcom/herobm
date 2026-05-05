import { drizzle } from 'drizzle-orm/pglite';
import { PGlite } from '@electric-sql/pglite';
import * as schema from './apps/api/src/drizzle/modbm-core-schema';
import { runStandardSeeds } from './apps/api/src/scripts/seed';

async function test() {
  const client = new PGlite();
  await client.exec('CREATE SCHEMA IF NOT EXISTS modbm_core;');
  const db = drizzle(client, { schema });
  await runStandardSeeds(db as any);
  
  const uoms = await db.select().from(schema.uomDictionary);
  console.log(uoms);
}
test().catch(console.error);
