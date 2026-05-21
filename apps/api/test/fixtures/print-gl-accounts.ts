import { PgliteDatabase } from 'drizzle-orm/pglite';
import { PGlite } from '@electric-sql/pglite';
import { createMemoryDb } from '../../test/utils/memory-db';
import { glAccounts } from '../../src/drizzle/modbm-core-schema';

async function main() {
  const { db } = await createMemoryDb();
  const accounts = await db.select().from(glAccounts);
  console.log('EXISTING ACCOUNTS:', accounts);
}

main().catch(console.error);
